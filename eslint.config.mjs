import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["tests/**/*.js", "tests/**/*.cjs", "tests-worker/**/*.mjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@next/next/no-assign-module-variable": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "dist/**",
    "public/**",
    "node_modules/**",
    "build/**",
    ".work/**",
    "cloudflare-env.d.ts",
  ]),
]);
