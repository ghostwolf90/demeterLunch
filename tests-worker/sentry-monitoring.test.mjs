import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SENTRY_DSN,
  SENTRY_TRACES_SAMPLE_RATE,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeSentrySpan,
  workerSentryOptions,
} from "../lib/sentry-monitoring.ts";

test("worker monitoring uses the supplied DSN and conservative defaults", () => {
  const options = workerSentryOptions("https://public@example.ingest.sentry.io/1");

  assert.equal(options.dsn, "https://public@example.ingest.sentry.io/1");
  assert.equal(options.environment, "production");
  assert.equal(options.tracesSampleRate, 0.1);
  assert.equal(options.strictTraceContinuation, true);
  assert.deepEqual(options.dataCollection, {
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
  });
  assert.deepEqual(options.tracePropagationTargets, []);
  assert.equal(SENTRY_TRACES_SAMPLE_RATE, 0.1);
  assert.match(DEFAULT_SENTRY_DSN, /^https:\/\/.+\.ingest\.us\.sentry\.io\//);
});

test("Sentry events retain diagnostic paths while removing family data", () => {
  const event = sanitizeSentryEvent({
    message: "Login failed for parent@example.com with 驗證碼 483291",
    user: { id: "family-123", email: "parent@example.com" },
    request: {
      method: "POST",
      url: "https://haohaofood.example/api/account?email=parent%40example.com#form",
      headers: { authorization: "Bearer secret-token", cookie: "session=secret" },
      cookies: { session: "secret" },
      query_string: "email=parent%40example.com",
      data: { child_name: "小明", birthday: "2018-01-01" },
    },
    extra: {
      food_name: "花椰菜",
      dish_name: "蒜炒花椰菜",
      support_email: "helper@example.com",
      safe_count: 3,
    },
  });

  assert.equal(event.message, "Login failed for [Filtered] with 驗證碼 [Filtered]");
  assert.equal(event.user, undefined);
  assert.deepEqual(event.request, {
    method: "POST",
    url: "https://haohaofood.example/api/account",
  });
  assert.deepEqual(event.extra, {
    food_name: "[Filtered]",
    dish_name: "[Filtered]",
    support_email: "[Filtered]",
    safe_count: 3,
  });
});

test("Sentry breadcrumbs redact secrets and URL query strings", () => {
  const breadcrumb = sanitizeSentryBreadcrumb({
    category: "fetch",
    message: "Authorization: Bearer very-secret",
    data: {
      url: "https://api.example.test/meal?child=42",
      token: "very-secret",
      status_code: 500,
    },
  });

  assert.equal(breadcrumb.message, "Authorization: Bearer [Filtered]");
  assert.deepEqual(breadcrumb.data, {
    url: "https://api.example.test/meal",
    token: "[Filtered]",
    status_code: 500,
  });
});

test("Sentry spans keep timing data without private attributes", () => {
  const span = sanitizeSentrySpan({
    data: {
      "url.full": "https://haohaofood.example/api/family?child=42",
      "user.email": "parent@example.com",
      "session.id": "session-secret",
      "http.response.status_code": 200,
    },
    description: "Request for parent@example.com",
  });

  assert.deepEqual(span, {
    data: {
      "url.full": "https://haohaofood.example/api/family",
      "user.email": "[Filtered]",
      "session.id": "[Filtered]",
      "http.response.status_code": 200,
    },
    description: "Request for [Filtered]",
  });
});
