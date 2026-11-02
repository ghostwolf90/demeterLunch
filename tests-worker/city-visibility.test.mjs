import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";


function loadSchoolsModule() {
  const source = readFileSync(new URL("../lib/schools.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  }).outputText;
  const schools = [
    { city: "甲市", district: "東區", level: "國小", name: "甲一", fullName: "甲市東區甲一", fatraceSchoolId: 1 },
    { city: "乙縣", district: "西區", level: "國小", name: "乙一", fullName: "乙縣西區乙一", fatraceSchoolId: 2 },
  ];
  const fixtures = {
    "@/data/reference/active-elementary-schools.json": { schools },
    "@/data/reference/city-visibility.json": {
      cities: [
        { name: "甲市", enabled: true },
        { name: "乙縣", enabled: false },
      ],
    },
    "@/data/reference/school-refresh-groups.json": { groups: [] },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require(name) {
      if (!(name in fixtures)) throw new Error(`Unexpected import: ${name}`);
      return fixtures[name];
    },
    Set,
  });
  return module.exports;
}


test("public school directory includes only explicitly enabled cities", () => {
  const schools = loadSchoolsModule();
  assert.deepEqual(
    schools.publicSchoolDirectory().map((school) => school.city),
    ["甲市"],
  );
  assert.deepEqual(
    schools.allSchools().map((school) => school.city),
    ["甲市", "乙縣"],
    "visibility must not delete schools from refresh and data operations",
  );
});
