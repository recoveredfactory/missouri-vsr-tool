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
    const webDomain = isProdStage
      ? "vsr.recoveredfactory.net"
      : isStagingStage
        ? "staging.vsr.recoveredfactory.net"
        : undefined;

    new sst.aws.SvelteKit("Web", {
      path: "packages/web",
      domain: webDomain,
      environment: {
        PUBLIC_DONATE_URL: process.env.PUBLIC_DONATE_URL ?? "",
      },
    });
  },
});
