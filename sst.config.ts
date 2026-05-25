/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const isProdStage = ["prod", "production"].includes(input?.stage);
    return {
      name: "missouri-vsr-tool",
      removal: isProdStage ? "retain" : "remove",
      protect: isProdStage,
      home: "aws",
    };
  },
  async run() {
    const isProdStage = ["prod", "production"].includes($app.stage);
    const isStagingStage = ["staging", "stage"].includes($app.stage);
    const localEnv = await (async () => {
      try {
        const { readFileSync, existsSync } = await import("node:fs");
        const { resolve } = await import("node:path");
        const envPath = resolve(process.cwd(), ".env");
        if (!existsSync(envPath)) return {};
        const contents = readFileSync(envPath, "utf-8");
        const entries = contents.split(/\r?\n/);
        const parsed = {};
        for (const line of entries) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const idx = trimmed.indexOf("=");
          if (idx === -1) continue;
          const key = trimmed.slice(0, idx).trim();
          let value = trimmed.slice(idx + 1).trim();
          if (
            (value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          parsed[key] = value;
        }
        return parsed;
      } catch {
        return {};
      }
    })();
    const env = { ...process.env, ...localEnv };
    const webDomain = isProdStage
      ? "vsr.recoveredfactory.net"
      : isStagingStage
        ? "staging.vsr.recoveredfactory.net"
        : undefined;

    let dataRouter;
    if (isProdStage) {
      const dataBucketName = env.MISSOURI_VSR_BUCKET_NAME;
      const dataBucketRegion = env.MISSOURI_VSR_BUCKET_REGION || "us-east-2";
      const dataCdnDomain = env.DATA_CDN_DOMAIN || "data.vsr.recoveredfactory.net";
      if (!dataBucketName) {
        throw new Error("Missing MISSOURI_VSR_BUCKET_NAME for data CDN setup.");
      }

      const dataBucketProvider = new aws.Provider("DataBucketProvider", {
        region: dataBucketRegion,
      });
      const dataBucket = sst.aws.Bucket.get("DataBucket", dataBucketName, {
        provider: dataBucketProvider,
      });

      dataRouter = new sst.aws.Router("DataRouter", {
        domain: dataCdnDomain,
        routes: {
          "/*": {
            bucket: dataBucket,
            cachePolicy: "658327ea-f89d-4fab-a63d-7e88639e58f6",
            edge: {
              viewerResponse: {
                injection: [
                  "const allowedOrigins = [",
                  '  "https://vsr.recoveredfactory.net",',
                  '  "https://staging.vsr.recoveredfactory.net",',
                  "];",
                  "const originHeader = event.request.headers.origin;",
                  "const origin = originHeader && originHeader.value;",
                  "const isLocalhost = origin && (origin.startsWith(\"http://localhost:\") || origin.startsWith(\"http://127.0.0.1:\") || origin.startsWith(\"https://localhost:\") || origin.startsWith(\"https://127.0.0.1:\"));",
                  "if (origin && (allowedOrigins.includes(origin) || isLocalhost)) {",
                  '  event.response.headers["access-control-allow-origin"] = { value: origin };',
                  '  event.response.headers["vary"] = { value: "Origin" };',
                  '  event.response.headers["access-control-allow-methods"] = { value: "GET,HEAD,OPTIONS" };',
                  '  event.response.headers["access-control-allow-headers"] = { value: "*" };',
                  "}",
                ].join("\n"),
              },
            },
          },
        },
      });
    }

    const dataBaseUrl =
      env.PUBLIC_DATA_BASE_URL && env.PUBLIC_DATA_BASE_URL !== "/data"
        ? env.PUBLIC_DATA_BASE_URL
        : env.DATA_CDN_DOMAIN
          ? `https://${env.DATA_CDN_DOMAIN}`
          : env.PUBLIC_DATA_BASE_URL ?? "";

    new sst.aws.SvelteKit("Web", {
      path: "packages/web",
      domain: webDomain,
      warm: isProdStage ? 1 : 0,
      environment: {
        PUBLIC_DONATE_URL: env.PUBLIC_DONATE_URL ?? "",
        PUBLIC_DATA_BASE_URL: dataBaseUrl,
        PUBLIC_DATA_RELEASE_PATH: env.PUBLIC_DATA_RELEASE_PATH ?? "",
      },
    });

    const mcp = new sst.aws.Function("Mcp", {
      handler: "packages/mcp/src/index.handler",
      runtime: "nodejs22.x",
      memory: "1024 MB",
      timeout: "30 seconds",
      // Cold start is ~8–15s (76MB Parquet + JSON + SVG fetch from
      // CloudFront, DuckDB table builds, metric coverage scan). Keep one
      // container warm in prod so the first user of each session doesn't
      // eat that latency. Same pattern as the SvelteKit Web app above.
      warm: isProdStage ? 1 : 0,
      url: {
        cors: {
          allowMethods: ["GET", "POST"],
          allowOrigins: ["*"],
          allowHeaders: ["content-type", "mcp-session-id", "mcp-protocol-version"],
        },
      },
      environment: {
        DATA_BASE_URL: dataBaseUrl,
        DATA_RELEASE_PATH: env.PUBLIC_DATA_RELEASE_PATH ?? "",
      },
      nodejs: {
        install: ["@duckdb/node-api", "@resvg/resvg-js"],
      },
    });

    // WAF can't attach to Lambda Function URLs directly — it needs a
    // CloudFront / API Gateway / ALB in front. We put CloudFront in front
    // of the Lambda URL with a single rate-based rule, ~3000 req per 5 min
    // per IP (≈10/s sustained). The Lambda URL stays public for emergency
    // bypass, but the documented endpoint is the CloudFront one.
    const cloudfrontProvider = new aws.Provider("McpWafProvider", {
      region: "us-east-1",
    });

    const mcpWaf = new aws.wafv2.WebAcl(
      "McpWaf",
      {
        scope: "CLOUDFRONT",
        defaultAction: { allow: {} },
        rules: [
          {
            name: "RateLimitPerIp",
            priority: 1,
            statement: {
              rateBasedStatement: {
                limit: 3000,
                aggregateKeyType: "IP",
              },
            },
            action: { block: {} },
            visibilityConfig: {
              cloudwatchMetricsEnabled: true,
              metricName: "McpWafRateLimit",
              sampledRequestsEnabled: true,
            },
          },
        ],
        visibilityConfig: {
          cloudwatchMetricsEnabled: true,
          metricName: "McpWaf",
          sampledRequestsEnabled: true,
        },
      },
      { provider: cloudfrontProvider },
    );

    const mcpOriginHost = mcp.url.apply((u) => new URL(u).hostname);

    const mcpCdn = new aws.cloudfront.Distribution("McpCdn", {
      enabled: true,
      isIpv6Enabled: true,
      httpVersion: "http2",
      priceClass: "PriceClass_100",
      webAclId: mcpWaf.arn,
      origins: [
        {
          originId: "mcp-lambda-url",
          domainName: mcpOriginHost,
          customOriginConfig: {
            httpPort: 80,
            httpsPort: 443,
            originProtocolPolicy: "https-only",
            originSslProtocols: ["TLSv1.2"],
          },
        },
      ],
      defaultCacheBehavior: {
        targetOriginId: "mcp-lambda-url",
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
        cachedMethods: ["GET", "HEAD"],
        // AWS managed cache policy: CachingDisabled.
        cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        // AWS managed origin request policy: AllViewerExceptHostHeader.
        originRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac",
        compress: true,
      },
      restrictions: {
        geoRestriction: { restrictionType: "none" },
      },
      viewerCertificate: { cloudfrontDefaultCertificate: true },
    });

    return {
      dataCdnDistributionId: dataRouter?.distributionID,
      dataCdnDomain: dataRouter?.url,
      mcpLambdaUrl: mcp.url,
      mcpUrl: mcpCdn.domainName.apply((d) => `https://${d}/`),
    };
  },
});
