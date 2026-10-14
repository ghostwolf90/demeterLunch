import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeManualPublisher,
  ManualPublishAuthError,
} from "../lib/manual-publish-auth.ts";

test("manual publisher accepts only the configured bearer token", async () => {
  const token = "a".repeat(64);
  const accepted = new Request("https://example.test/api/admin/publish", {
    headers: { authorization: `Bearer ${token}` },
  });
  await assert.doesNotReject(() => authorizeManualPublisher(accepted, token));

  const rejected = new Request("https://example.test/api/admin/publish", {
    headers: { authorization: `Bearer ${"b".repeat(64)}` },
  });
  await assert.rejects(
    () => authorizeManualPublisher(rejected, token),
    (error) => error instanceof ManualPublishAuthError && error.status === 403,
  );
});
