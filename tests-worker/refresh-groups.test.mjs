import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const registry = JSON.parse(
  await readFile(new URL("../data/reference/active-elementary-schools.json", import.meta.url)),
);
const plan = JSON.parse(
  await readFile(new URL("../data/reference/school-refresh-groups.json", import.meta.url)),
);

test("refresh groups contain every school exactly once and keep configured city order", () => {
  const seen = new Set();
  const expectedCityOrder = ["臺北市", "桃園市", "苗栗縣", "臺中市", "彰化縣", "臺南市"];
  assert.deepEqual(plan.cityOrder, expectedCityOrder);
  let previousCityIndex = -1;
  for (const group of plan.groups) {
    const cityIndex = expectedCityOrder.indexOf(group.city);
    assert.notEqual(cityIndex, -1);
    assert.ok(cityIndex >= previousCityIndex);
    previousCityIndex = cityIndex;
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
