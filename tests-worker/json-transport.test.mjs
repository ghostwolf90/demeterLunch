import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJsonPreservingLargeIntegers,
  sha256Hex,
  stableStringify,
} from "../lib/json-transport.ts";

test("preserves integers larger than JavaScript's safe range as strings", () => {
  const parsed = parseJsonPreservingLargeIntegers(
    '{"dishId":14724489882226695,"safe":193609,"label":"14724489882226695"}',
    "record",
  );

  assert.equal(parsed.dishId, "14724489882226695");
  assert.equal(parsed.safe, 193609);
  assert.equal(parsed.label, "14724489882226695");
});

test("stable JSON and SHA-256 are deterministic", async () => {
  const stable = stableStringify({ z: 1, a: { large: "14724489882226695" } });

  assert.equal(stable, '{"a":{"large":"14724489882226695"},"z":1}');
  assert.equal(
    await sha256Hex(stable),
    "7383e823caa439bab15e130ab22f32686ff6b76e3bfd1f13ba79809cb0f2fa3c",
  );
});
