import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const staticRoot = resolve(projectRoot, "dist");
const publicRoot = resolve(projectRoot, "public");

await rm(publicRoot, { recursive: true, force: true });
await mkdir(publicRoot, { recursive: true });
await cp(staticRoot, publicRoot, { recursive: true });

const siteDataPath = resolve(publicRoot, "data", "site-data.json");
const schoolMealsRoot = resolve(publicRoot, "data", "school-meals");
const siteData = JSON.parse(await readFile(siteDataPath, "utf8"));
const schoolRecords = siteData.officialSchoolMeals?.records ?? {};
await mkdir(schoolMealsRoot, { recursive: true });
await Promise.all(
  Object.entries(schoolRecords).map(([schoolId, records]) =>
    writeFile(
      resolve(schoolMealsRoot, `${schoolId}.json`),
      JSON.stringify({ schemaVersion: 1, schoolId: Number(schoolId), records }),
      "utf8",
    ),
  ),
);

console.log(
  `Prepared Worker assets in ${publicRoot} (${Object.keys(schoolRecords).length} school snapshots)`,
);
