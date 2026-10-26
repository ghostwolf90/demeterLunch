declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MAINTENANCE_API_TOKEN?: string;
    LINE_CHANNEL_ID?: string;
    LINE_CHANNEL_SECRET?: string;
    LINE_REDIRECT_URI?: string;
    BUCKET?: R2Bucket;
    EMAIL_AUTH_SECRET?: string;
    EMAIL_AUTH_DEV_CODE?: string;
    RESEND_API_KEY?: string;
    AUTH_EMAIL_FROM?: string;
    SENTRY_DSN?: string;
    MANUAL_PUBLISH_TOKEN?: string;
  }
}
