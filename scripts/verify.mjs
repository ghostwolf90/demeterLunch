#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verbose = process.argv.includes("--verbose") || process.env.DEMETER_VERIFY_VERBOSE === "1";

function versionTuple(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`無法解析 Node.js 版本：${version}`);
  return match.slice(1).map(Number);
}

function versionAtLeast(current, minimum) {
  for (let index = 0; index < 3; index += 1) {
    if (current[index] !== minimum[index]) return current[index] > minimum[index];
  }
  return true;
}

async function requiredNodeVersion() {
  const packageJson = JSON.parse(
    await readFile(path.join(PROJECT_ROOT, "package.json"), "utf8"),
  );
  const requirement = String(packageJson.engines?.node || "");
  const match = requirement.match(/^>=\s*(\d+\.\d+\.\d+)$/);
  if (!match) throw new Error(`不支援的 engines.node 格式：${requirement || "未設定"}`);
  return match[1];
}

async function filesUnder(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(entryPath, extension));
    else if (entry.isFile() && entry.name.endsWith(extension)) files.push(entryPath);
  }
  return files;
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    if (!verbose) {
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
    }
    child.on("error", (error) => {
      resolve({
        code: 1,
        output: `無法執行 ${command}：${error.message}`,
      });
    });
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        output: verbose
          ? ""
          : `${Buffer.concat(stdout).toString()}${Buffer.concat(stderr).toString()}`.trim(),
      });
    });
  });
}

async function runJavaScriptSyntaxChecks(files) {
  const failures = [];
  for (const file of files) {
    if (verbose) console.log(`$ node --check ${path.relative(PROJECT_ROOT, file)}`);
    const result = await runCommand(process.execPath, ["--check", file]);
    if (result.code !== 0) {
      failures.push(`${path.relative(PROJECT_ROOT, file)}\n${result.output}`.trim());
    }
  }
  return {
    code: failures.length ? 1 : 0,
    output: failures.join("\n\n"),
  };
}

async function runPhase(label, task) {
  const startedAt = performance.now();
  if (verbose) console.log(`\n[${label}]`);
  else process.stdout.write(`${label}… `);
  const result = await task();
  const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
  if (result.code === 0) {
    if (!verbose) console.log(`通過（${elapsed} 秒）`);
    return true;
  }
  if (!verbose) console.log(`失敗（${elapsed} 秒）`);
  if (result.output) process.stderr.write(`\n${result.output}\n`);
  return false;
}

async function main() {
  const minimumNode = await requiredNodeVersion();
  const currentNode = process.versions.node;
  if (!versionAtLeast(versionTuple(currentNode), versionTuple(minimumNode))) {
    throw new Error(`Node.js ${currentNode} 不符合專案需求 >=${minimumNode}`);
  }

  const workerTests = await filesUnder(path.join(PROJECT_ROOT, "tests-worker"), ".test.mjs");
  const webJavaScript = await filesUnder(path.join(PROJECT_ROOT, "web"), ".js");
  if (!workerTests.length) throw new Error("找不到 Worker 測試檔");
  if (!webJavaScript.length) throw new Error("找不到 web JavaScript 檔案");

  console.log(`Node.js ${currentNode}；整合驗證 4 類`);
  const python = process.env.DEMETER_PYTHON || "python3";
  const phases = [
    [
      "Python 測試",
      () => runCommand(python, ["-m", "unittest", "discover", "-s", "tests", ...(verbose ? ["-v"] : [])]),
    ],
    [
      "Worker 測試",
      () => runCommand(process.execPath, ["--test", ...workerTests]),
    ],
    [
      "TypeScript",
      () => runCommand(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"]),
    ],
    [
      "JavaScript 語法",
      () => runJavaScriptSyntaxChecks(webJavaScript),
    ],
  ];

  const results = [];
  for (const [label, task] of phases) results.push(await runPhase(label, task));
  const passed = results.filter(Boolean).length;
  if (passed !== phases.length) {
    console.error(`\n整合驗證失敗：${passed}/${phases.length} 類通過。`);
    return 1;
  }
  console.log(`整合驗證完成：${passed}/${phases.length} 類通過。`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`整合驗證無法啟動：${error.message}`);
    process.exitCode = 1;
  });
