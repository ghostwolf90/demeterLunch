import assert from "node:assert/strict";
import test from "node:test";

import { authorizeSiteWriter } from "../lib/mcp-auth.ts";

test("writer authorization accepts the verified owner email across Site-scoped IDs", () => {
  const request = new Request("https://example.test/mcp", {
    headers: {
      "oai-authenticated-user-id": "site-scoped-user-id",
      "oai-authenticated-user-email": " Owner@Example.com ",
    },
  });

  assert.doesNotThrow(() =>
    authorizeSiteWriter(
      request,
      {
        MCP_OWNER_EMAIL: "owner@example.com",
        MCP_OWNER_USER_ID: "unrelated-account-policy-id",
      },
      "refresh_school_group",
    ),
  );
});

test("writer authorization rejects a different verified email", () => {
  const request = new Request("https://example.test/mcp", {
    headers: {
      "oai-authenticated-user-id": "another-site-user-id",
      "oai-authenticated-user-email": "someone@example.com",
    },
  });

  assert.throws(
    () =>
      authorizeSiteWriter(
        request,
        { MCP_OWNER_EMAIL: "owner@example.com" },
        "refresh_school_group",
      ),
    /沒有更新午餐資料的權限/,
  );
});

test("writer authorization still permits the read-only status tool", () => {
  const request = new Request("https://example.test/mcp");
  assert.doesNotThrow(() =>
    authorizeSiteWriter(
      request,
      { MCP_OWNER_EMAIL: "owner@example.com" },
      "get_refresh_status",
    ),
  );
});
