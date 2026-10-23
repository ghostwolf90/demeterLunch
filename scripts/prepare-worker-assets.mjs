import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const staticRoot = resolve(projectRoot, "dist");
const publicRoot = resolve(projectRoot, "public");

await rm(publicRoot, { recursive: true, force: true });
await mkdir(publicRoot, { recursive: true });
await cp(staticRoot, publicRoot, { recursive: true });

const schoolMealsRoot = resolve(publicRoot, "data", "school-meals");
await mkdir(schoolMealsRoot, { recursive: true });
const schoolMealFiles = (await readdir(schoolMealsRoot)).filter((name) => name.endsWith(".json"));
if (!schoolMealFiles.length) throw new Error("Static build did not produce school meal snapshots");

console.log(
  `Prepared Worker assets in ${publicRoot} (${schoolMealFiles.length} school snapshots)`,
);
