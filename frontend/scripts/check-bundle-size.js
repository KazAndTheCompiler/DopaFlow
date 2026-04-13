#!/usr/bin/env node
/**
 * check-bundle-size.js
 * Hard-fails if total JS bundle exceeds the configured budget.
 * Run after `vite build`.
 *
 * Budget: 5MB hard cap, 2MB soft warning (Vite chunkSizeWarningLimit).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIST_DIR = new URL("../dist", import.meta.url);
const HARD_LIMIT_KB = 5 * 1024; // 5MB

function getJsFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getJsFiles(full));
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) {
      files.push(full);
    }
  }
  return files;
}

const jsFiles = getJsFiles(DIST_DIR);
let totalKb = 0;
const sizes = [];

for (const file of jsFiles) {
  const size = readFileSync(file).length;
  const kb = Math.ceil(size / 1024);
  totalKb += kb;
  sizes.push({ file: file.replace(DIST_DIR + "/", ""), kb });
}

console.log(`\nBundle size report:`);
for (const { file, kb } of sizes.sort((a, b) => b.kb - a.kb)) {
  const marker = kb > 2048 ? " ⚠️" : "";
  console.log(`  ${String(kb).padStart(6)} KB  ${file}${marker}`);
}
console.log(`  ${"─".repeat(50)}`);
console.log(`  ${String(totalKb).padStart(6)} KB  TOTAL${totalKb > HARD_LIMIT_KB ? " ❌ OVER HARD LIMIT" : ""}\n`);

if (totalKb > HARD_LIMIT_KB) {
  console.error(`ERROR: Bundle size (${totalKb} KB) exceeds hard limit of ${HARD_LIMIT_KB} KB.`);
  process.exit(1);
}
