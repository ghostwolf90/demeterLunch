import type {
  Breadcrumb,
  CloudflareOptions,
  ErrorEvent,
} from "@sentry/cloudflare";

export const DEFAULT_SENTRY_DSN =
  "https://d955323db49bc1b72107525275497061@o4512280284561408.ingest.us.sentry.io/4512280295440384";

export const SENTRY_TRACES_SAMPLE_RATE = 0.1;

const FILTERED = "[Filtered]";
const SENSITIVE_KEY = /(?:^|_)(?:authorization|cookie|email|birth(?:day|date)?|password|secret|session|token|otp|verification_code|child(?:_name)?|display_name|nickname|avatar(?:_key)?|food_name|dish_name|meal_context|school)(?:$|_)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_TOKEN = /\bBearer\s+[^\s,;]+/gi;
const VERIFICATION_CODE = /((?:驗證碼|verification\s*code|one[- ]time\s*(?:password|code)|otp)[^\d]{0,20})\d{6}\b/gi;

function normalizedKey(key: string) {
  return key.replace(/[^a-z0-9]+/gi, "_");
}

function redactText(value: string) {
  return value
    .replace(EMAIL, FILTERED)
    .replace(BEARER_TOKEN, `Bearer ${FILTERED}`)
    .replace(VERIFICATION_CODE, `$1${FILTERED}`);
}

function urlWithoutQuery(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return redactText(value);
  }
}

function redactValue(value: unknown, key = ""): unknown {
  const comparableKey = normalizedKey(key);
  if (SENSITIVE_KEY.test(comparableKey)) return FILTERED;
  if (typeof value === "string") {
    return /(?:^|_)(?:url|uri|href)(?:$|_)/i.test(comparableKey)
      ? urlWithoutQuery(value)
      : redactText(value);
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([nestedKey, nestedValue]) => [
      nestedKey,
      redactValue(nestedValue, nestedKey),
    ]),
  );
}

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  const sanitized = redactValue(event) as ErrorEvent;
  sanitized.user = undefined;

  if (sanitized.request) {
    sanitized.request = {
      method: sanitized.request.method,
      url: sanitized.request.url
        ? urlWithoutQuery(sanitized.request.url)
        : undefined,
    };
  }

  return sanitized;
}

export function sanitizeSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return redactValue(breadcrumb) as Breadcrumb;
}

type BeforeSendSpan = NonNullable<CloudflareOptions["beforeSendSpan"]>;
type StreamedSpan = Parameters<BeforeSendSpan>[0];

export function sanitizeSentrySpan(span: StreamedSpan): StreamedSpan {
  return redactValue(span) as StreamedSpan;
}

export function workerSentryOptions(dsn = DEFAULT_SENTRY_DSN): CloudflareOptions {
  return {
    dsn,
    environment: "production",
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    strictTraceContinuation: true,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 5,
    },
    // Do not add Sentry trace headers to third-party lunch, email or Telegram APIs.
    tracePropagationTargets: [],
    beforeSend: sanitizeSentryEvent,
    beforeBreadcrumb: sanitizeSentryBreadcrumb,
    beforeSendSpan: sanitizeSentrySpan,
  };
}
