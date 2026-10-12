import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const registry = JSON.parse(
  await readFile(new URL("../data/reference/taichung-active-elementary-schools.json", import.meta.url)),
);
const plan = JSON.parse(
  await readFile(new URL("../data/reference/taichung-school-refresh-groups.json", import.meta.url)),
);

test("three refresh groups contain every school exactly once", () => {
  const seen = new Set();
  for (const group of plan.groups) {
    const districts = new Set(group.districts);
    const schools = registry.schools.filter((school) => districts.has(school.district));
    assert.equal(schools.length, 81);
    assert.equal(schools.length, group.expectedSchoolCount);
    for (const school of schools) {
      assert.equal(seen.has(school.fatraceSchoolId), false);
      seen.add(school.fatraceSchoolId);
    }
  }
  assert.equal(seen.size, 243);
});

test("refresh plan does not invent districts", () => {
  const registryDistricts = new Set(registry.schools.map((school) => school.district));
  const plannedDistricts = new Set(plan.groups.flatMap((group) => group.districts));
  assert.deepEqual([...plannedDistricts].sort(), [...registryDistricts].sort());
});
