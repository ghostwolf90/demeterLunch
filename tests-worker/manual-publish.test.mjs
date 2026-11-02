import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeManualPublisher,
  ManualPublishAuthError,
} from "../lib/manual-publish-auth.ts";
import { validateManualPublishBatchCounts } from "../lib/manual-publish-bundle.ts";
import { findSchoolIdentityMismatch } from "../lib/school-record-identity.ts";

const schoolRecordIdentity = {
  city: "臺南市",
  district: "玉井區",
  level: "國小",
  name: "玉井國小",
  fullName: "臺南市玉井區玉井國小",
  fatraceSchoolId: 64736433,
};

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

test("manual publisher accepts internally consistent batches of any positive size", () => {
  assert.deepEqual(
    validateManualPublishBatchCounts(
      { schools: 1, available: 1, noMeal: 0, notPublished: 0, failed: 0 },
      1,
      1,
    ),
    { schools: 1, available: 1, noMeal: 0, notPublished: 0 },
  );
  assert.deepEqual(
    validateManualPublishBatchCounts(
      { schools: 3, available: 1, noMeal: 1, notPublished: 1, failed: 0 },
      3,
      2,
    ),
    { schools: 3, available: 1, noMeal: 1, notPublished: 1 },
  );
});

test("manual publisher rejects empty, failed, or inconsistent batches", () => {
  assert.throws(
    () => validateManualPublishBatchCounts(
      { schools: 0, available: 0, noMeal: 0, notPublished: 0, failed: 0 },
      0,
      0,
    ),
    /數量不一致/,
  );
  assert.throws(
    () => validateManualPublishBatchCounts(
      { schools: 1, available: 0, noMeal: 0, notPublished: 0, failed: 1 },
      1,
      0,
    ),
    /不得包含抓取失敗/,
  );
  assert.throws(
    () => validateManualPublishBatchCounts(
      { schools: 2, available: 1, noMeal: 0, notPublished: 0, failed: 0 },
      1,
      1,
    ),
    /數量不一致/,
  );
});

test("school record identity ignores registry-only metadata", () => {
  const registrySchool = {
    ...schoolRecordIdentity,
    moeSchoolCode: "114636",
  };

  assert.equal(
    findSchoolIdentityMismatch(schoolRecordIdentity, registrySchool),
    null,
  );
});

test("school record identity still detects actual mismatches", () => {
  const registrySchool = {
    ...schoolRecordIdentity,
    name: "另一所國小",
    moeSchoolCode: "114636",
  };

  assert.equal(
    findSchoolIdentityMismatch(schoolRecordIdentity, registrySchool),
    "name",
  );
});
