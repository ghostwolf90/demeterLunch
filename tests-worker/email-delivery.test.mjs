import assert from "node:assert/strict";
import test from "node:test";

import {
  MAACGO_EMAIL_ENDPOINT,
  maacGoAuthorization,
  sendMaacGoVerificationEmail,
  verificationEmailContent,
} from "../lib/email-delivery.ts";

test("MAAC Go authorization accepts either a raw key or complete Bearer value", () => {
  assert.equal(maacGoAuthorization("sk_test_example"), "Bearer sk_test_example");
  assert.equal(
    maacGoAuthorization("Bearer sk_test_example"),
    "Bearer sk_test_example",
  );
  assert.equal(maacGoAuthorization("  "), null);
});

test("verification email contains the approved Traditional Chinese OTP copy", () => {
  const content = verificationEmailContent("483291", 10);
  assert.equal(content.subject, "【好好吃飯】您的登入驗證碼");
  assert.match(content.text, /483291/);
  assert.match(content.text, /10 分鐘後失效/);
  assert.match(content.text, /只能使用一次/);
  assert.match(content.html, /好好吃飯｜午餐助手/);
  assert.doesNotMatch(content.html, /取消訂閱|Start shopping|WELCOME10/);
});

test("MAAC Go test delivery calls the transactional API without reaching an inbox", async () => {
  let capturedUrl;
  let capturedInit;
  const delivery = await sendMaacGoVerificationEmail({
    authorization: "Bearer sk_test_example",
    email: "parent@example.com",
    code: "483291",
    ttlMinutes: 10,
    fetcher: async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(JSON.stringify({
        id: "test-message-1",
        status: "queued",
        test_mode: true,
        delivery: "skipped_test_mode",
      }), {
        status: 202,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(capturedUrl, MAACGO_EMAIL_ENDPOINT);
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers.authorization, "Bearer sk_test_example");
  const body = JSON.parse(capturedInit.body);
  assert.equal(body.to, "parent@example.com");
  assert.equal(body.from, "好好吃飯｜午餐助手");
  assert.match(body.subject, /登入驗證碼/);
  assert.match(body.html, /483291/);
  assert.deepEqual(delivery, {
    provider: "maacgo",
    messageId: "test-message-1",
    testMode: true,
  });
});

test("MAAC Go delivery rejects provider errors", async () => {
  await assert.rejects(
    sendMaacGoVerificationEmail({
      authorization: "sk_test_invalid",
      email: "parent@example.com",
      code: "483291",
      ttlMinutes: 10,
      fetcher: async () => new Response("Forbidden", { status: 403 }),
    }),
    /MAAC Go email delivery failed \(403\)/,
  );
});
