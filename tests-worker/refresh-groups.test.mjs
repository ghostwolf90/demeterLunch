import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const registry = JSON.parse(
  await readFile(new URL("../data/reference/active-elementary-schools.json", import.meta.url)),
);
const plan = JSON.parse(
  await readFile(new URL("../data/reference/school-refresh-groups.json", import.meta.url)),
);

test("refresh groups contain every school exactly once and keep Taichung first", () => {
  const seen = new Set();
  let reachedTainan = false;
  for (const group of plan.groups) {
    if (group.city === "臺南市") reachedTainan = true;
    if (reachedTainan) assert.equal(group.city, "臺南市");
    const districts = new Set(group.districts);
    const schools = registry.schools.filter(
      (school) => school.city === group.city && districts.has(school.district),
    );
    assert.equal(schools.length, group.expectedSchoolCount);
    for (const school of schools) {
      assert.equal(seen.has(school.fatraceSchoolId), false);
      seen.add(school.fatraceSchoolId);
    }
  }
  assert.equal(seen.size, registry.schools.length);
});

test("refresh plan does not invent districts", () => {
  const registryDistricts = new Set(
    registry.schools.map((school) => `${school.city}\0${school.district}`),
  );
  const plannedDistricts = new Set(
    plan.groups.flatMap((group) => group.districts.map((district) => `${group.city}\0${district}`)),
  );
  assert.deepEqual([...plannedDistricts].sort(), [...registryDistricts].sort());
});
