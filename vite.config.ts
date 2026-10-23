import vinext from "vinext";
import { sentryCloudflareVitePlugin } from "@sentry/cloudflare/vite";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";

const DEMETER_LOCAL_DATABASE_ID =
  "11111111-1111-4111-8111-111111111111";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";
const localAuthVars = Object.fromEntries(
  [
    "EMAIL_AUTH_SECRET",
    "EMAIL_AUTH_DEV_CODE",
    "RESEND_API_KEY",
    "AUTH_EMAIL_FROM",
    "SENTRY_DSN",
    "MANUAL_PUBLISH_TOKEN",
  ]
    .flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []),
) as Record<string, string>;

const localBindingConfig = {
  main: "./build/sites-worker.ts",
  compatibility_flags: ["nodejs_compat"],
  assets: {
    binding: "ASSETS",
    directory: "./public",
  },
  vars: localAuthVars,
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "demeter-local-d1",
          database_id: DEMETER_LOCAL_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async ({ command }) => {
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      ...(managedLinux
        ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] }
        : {}),
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites({ mockAuth: !managedLinux }),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
      sentryCloudflareVitePlugin({
        wranglerConfigPath: "./wrangler.local.jsonc",
      }),
    ],
  };
});
