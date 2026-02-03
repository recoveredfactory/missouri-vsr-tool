/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "missouri-vsr-tool",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    new sst.aws.SvelteKit("Web", {
      path: "packages/web",
      domain: "vsr.grupovisual.org",
      environment: {
        PUBLIC_DONATE_URL: process.env.PUBLIC_DONATE_URL ?? "",
      },
    });
  },
});
