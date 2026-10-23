declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    EMAIL_AUTH_SECRET?: string;
    EMAIL_AUTH_DEV_CODE?: string;
    RESEND_API_KEY?: string;
    AUTH_EMAIL_FROM?: string;
    SENTRY_DSN?: string;
    MANUAL_PUBLISH_TOKEN?: string;
  }
}
