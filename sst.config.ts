/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    // Only "prod" counts as production. "production" used to be allowed too,
    // but the alias caused a typo-deploy (2026-05-27) that stood up a
    // half-failed stack we then had to tear down — and `protect: true` on
    // that typo stack made the cleanup awkward. Stick to one canonical name.
    const isProdStage = input?.stage === "prod";
    return {
      name: "missouri-vsr-tool",
      removal: isProdStage ? "retain" : "remove",
      protect: isProdStage,
      home: "aws",
    };
  },
  async run() {
    const isProdStage = $app.stage === "prod";
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

    // Stage-aware MCP URL surfaced to the homepage. Prod and staging point
    // at their custom domains; dev/local stages fall through to staging so
    // the banner has somewhere to land before prod ships.
    const publicMcpUrl = isProdStage
      ? "https://mcp.vsr.recoveredfactory.net/"
      : "https://mcp-staging.vsr.recoveredfactory.net/";

    new sst.aws.SvelteKit("Web", {
      path: "packages/web",
      domain: webDomain,
      warm: isProdStage ? 1 : 0,
      environment: {
        PUBLIC_DONATE_URL: env.PUBLIC_DONATE_URL ?? "",
        PUBLIC_DATA_BASE_URL: dataBaseUrl,
        PUBLIC_DATA_RELEASE_PATH: env.PUBLIC_DATA_RELEASE_PATH ?? "",
        PUBLIC_MCP_URL: publicMcpUrl,
        // Staging password gate. Set ONLY on the staging stage, so prod and
        // local dev are never gated (the hook keys off the var's presence).
        // Supply STAGING_PASSWORD in the staging deploy env / .env; if it's
        // blank the gate stays open. See packages/web/src/lib/server/gate.ts.
        ...(isStagingStage && env.STAGING_PASSWORD
          ? { STAGING_PASSWORD: env.STAGING_PASSWORD }
          : {}),
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
      // Hard cost ceiling — this, not the WAF rule, is the real backstop
      // against a runaway bill. A distributed flood sails under any per-IP
      // WAF limit, so total parallelism is what bounds spend. At 2 concurrent
      // × 1024MB × 30s, worst-case fully-saturated 24/7 is ~$85/mo; realistic
      // abuse is far less and budget alerts fire long before. Raise if real
      // load needs it (each +1 adds ~$43/mo to the worst case).
      concurrency: { reserved: 2 },
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
        // Umami analytics for MCP tool dispatch. See packages/mcp/src/analytics.ts
        // for the privacy posture (no args, no IPs, no session linkage,
        // single source of truth in Umami). Defaults to the web property's
        // ID if no MCP-specific one is set.
        MCP_UMAMI_WEBSITE_ID:
          env.MCP_UMAMI_WEBSITE_ID ?? env.PUBLIC_UMAMI_WEBSITE_ID ?? "",
        MCP_UMAMI_HOST: env.MCP_UMAMI_HOST ?? "cloud.umami.is",
        SST_STAGE: $app.stage,
      },
      nodejs: {
        install: ["@duckdb/node-api", "@resvg/resvg-js"],
      },
    });

    // WAF can't attach to Lambda Function URLs directly — it needs a
    // CloudFront / API Gateway / ALB in front. We put CloudFront in front
    // of the Lambda URL with a single rate-based rule, ~600 req per 5 min
    // per IP (≈2/s sustained — generous for any real MCP client, throttles a
    // single abuser fast). The Lambda URL stays public for emergency bypass,
    // but the documented endpoint is the CloudFront one.
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
                limit: 600,
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

    // Stage-specific hostname for the MCP. prod → mcp.vsr.recoveredfactory.net,
    // staging → mcp-staging.vsr.recoveredfactory.net. Dev stages keep the
    // auto-generated *.cloudfront.net hostname.
    const mcpDomain = isProdStage
      ? "mcp.vsr.recoveredfactory.net"
      : isStagingStage
        ? "mcp-staging.vsr.recoveredfactory.net"
        : undefined;

    // Provision ACM cert + Route 53 records when a domain is configured.
    // ACM cert must live in us-east-1 to be usable by CloudFront, which is
    // why we reuse the cloudfrontProvider (already pinned to us-east-1).
    let mcpCertArn: $util.Output<string> | undefined;
    let mcpAliases: string[] | undefined;
    if (mcpDomain) {
      const hostedZone = aws.route53.getZoneOutput({
        name: "recoveredfactory.net.",
      });
      const cert = new aws.acm.Certificate(
        "McpCert",
        {
          domainName: mcpDomain,
          validationMethod: "DNS",
        },
        { provider: cloudfrontProvider },
      );
      // One DNS validation record per validation option. With a single
      // domain (no SANs) there's exactly one.
      const certValidationRecord = new aws.route53.Record(
        "McpCertValidationRecord",
        {
          name: cert.domainValidationOptions[0].resourceRecordName,
          type: cert.domainValidationOptions[0].resourceRecordType,
          records: [cert.domainValidationOptions[0].resourceRecordValue],
          zoneId: hostedZone.zoneId,
          ttl: 60,
          allowOverwrite: true,
        },
      );
      const certValidation = new aws.acm.CertificateValidation(
        "McpCertValidation",
        {
          certificateArn: cert.arn,
          validationRecordFqdns: [certValidationRecord.fqdn],
        },
        { provider: cloudfrontProvider },
      );
      mcpCertArn = certValidation.certificateArn;
      mcpAliases = [mcpDomain];
    }

    const mcpCdn = new aws.cloudfront.Distribution("McpCdn", {
      enabled: true,
      isIpv6Enabled: true,
      httpVersion: "http2",
      priceClass: "PriceClass_100",
      webAclId: mcpWaf.arn,
      aliases: mcpAliases,
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
      viewerCertificate: mcpCertArn
        ? {
            acmCertificateArn: mcpCertArn,
            sslSupportMethod: "sni-only",
            minimumProtocolVersion: "TLSv1.2_2021",
          }
        : { cloudfrontDefaultCertificate: true },
    });

    // Route 53 alias records pointing the custom domain at CloudFront.
    // CloudFront's hosted-zone ID is the well-known Z2FDTNDATAQYW2 for all
    // distributions; we read it off the resource for type-safety.
    if (mcpDomain) {
      const hostedZone = aws.route53.getZoneOutput({
        name: "recoveredfactory.net.",
      });
      new aws.route53.Record("McpDnsA", {
        name: mcpDomain,
        type: "A",
        zoneId: hostedZone.zoneId,
        aliases: [
          {
            name: mcpCdn.domainName,
            zoneId: mcpCdn.hostedZoneId,
            evaluateTargetHealth: false,
          },
        ],
      });
      new aws.route53.Record("McpDnsAAAA", {
        name: mcpDomain,
        type: "AAAA",
        zoneId: hostedZone.zoneId,
        aliases: [
          {
            name: mcpCdn.domainName,
            zoneId: mcpCdn.hostedZoneId,
            evaluateTargetHealth: false,
          },
        ],
      });
    }

    // Cost guardrail — monthly AWS-account budget with email alerts. Fires
    // on actual (not forecast) spend at 50/80/100% so I get a warning shot
    // before any real bill. One budget per stage; both cover the full
    // account, so deploying both means redundant alerts (annoying, not
    // broken). Skipped when the alert email isn't set so dev stages don't
    // create stray budgets in the account.
    const budgetEmail = env.AWS_BUDGET_ALERT_EMAIL;
    if (budgetEmail && (isProdStage || isStagingStage)) {
      // Defaults sized to actual May 2026 run rate (~$1.70/day across the
      // account = ~$52/mo), with headroom for WAF + one-off domain renewals.
      // Override per-stage in .env if cost picture changes.
      const budgetLimitUsd = isProdStage
        ? env.AWS_BUDGET_LIMIT_PROD_USD ?? "75"
        : env.AWS_BUDGET_LIMIT_STAGING_USD ?? "30";
      new aws.budgets.Budget("McpCostGuard", {
        name: `${$app.name}-${$app.stage}-monthly`,
        budgetType: "COST",
        limitAmount: budgetLimitUsd,
        limitUnit: "USD",
        timeUnit: "MONTHLY",
        notifications: [50, 80, 100].map((threshold) => ({
          notificationType: "ACTUAL",
          comparisonOperator: "GREATER_THAN",
          threshold,
          thresholdType: "PERCENTAGE",
          subscriberEmailAddresses: [budgetEmail],
        })),
      });
    }

    return {
      dataCdnDistributionId: dataRouter?.distributionID,
      dataCdnDomain: dataRouter?.url,
      mcpLambdaUrl: mcp.url,
      mcpUrl: mcpDomain
        ? `https://${mcpDomain}/`
        : mcpCdn.domainName.apply((d) => `https://${d}/`),
      mcpCloudfrontUrl: mcpCdn.domainName.apply((d) => `https://${d}/`),
    };
  },
});
