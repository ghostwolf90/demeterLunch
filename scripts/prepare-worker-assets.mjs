import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const staticRoot = resolve(projectRoot, "dist");
const publicRoot = resolve(projectRoot, "public");

await rm(publicRoot, { recursive: true, force: true });
await mkdir(publicRoot, { recursive: true });
await cp(staticRoot, publicRoot, { recursive: true });

console.log(`Prepared Worker assets in ${publicRoot}`);
