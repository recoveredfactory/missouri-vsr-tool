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
    const env = { ...localEnv, ...process.env };
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
      });
      dataRouter.routeBucket(dataCdnDomain, dataBucket, {
        cachePolicy: "658327ea-f89d-4fab-a63d-7e88639e58f6",
      });
    }

    new sst.aws.SvelteKit("Web", {
      path: "packages/web",
      domain: webDomain,
      environment: {
        PUBLIC_DONATE_URL: env.PUBLIC_DONATE_URL ?? "",
        PUBLIC_DATA_BASE_URL: env.PUBLIC_DATA_BASE_URL ?? "",
      },
    });

    return {
      dataCdnDistributionId: dataRouter?.distributionID,
      dataCdnDomain: dataRouter?.url,
    };
  },
});
