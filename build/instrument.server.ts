import { defineCloudflareOptions } from "@sentry/cloudflare";
import {
  DEFAULT_SENTRY_DSN,
  workerSentryOptions,
} from "../lib/sentry-monitoring";

export default defineCloudflareOptions<Cloudflare.Env>((env) =>
  workerSentryOptions(env.SENTRY_DSN?.trim() || DEFAULT_SENTRY_DSN),
);
