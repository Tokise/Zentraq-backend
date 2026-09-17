/**
 * Copies the clinical-service domain code from supabase/functions/ to the
 * Cloudflare Worker, rewriting Deno-style imports to standard Node/bundler
 * imports along the way.
 *
 * Run from the Zentraq-backend workspace root:
 *   node scripts/copy-clinical-domain.mjs
 */

import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "supabase", "functions", "clinical-service", "domain");
const DEST = join(ROOT, "services", "clinical-worker", "src", "domain");

// Transforms applied to every .ts file
function transform(content, relPath) {
  let result = content;

  // 1. Strip npm: specifiers → bare package names
  //    e.g. "npm:zod@4.4.3" → "zod"
  //    e.g. "npm:@supabase/supabase-js@2.112.3" → "@supabase/supabase-js"
  //    e.g. "npm:@upstash/redis@1.38.3" → "@upstash/redis"
  result = result.replace(/["']npm:(@?[^@"']+)@[^"']+["']/g, '"$1"');

  // 2. Strip .ts extensions from relative imports
  //    e.g. from "./drafts.ts" → from "./drafts.js"
  //    (use .js for ESM compatibility with bundler moduleResolution)
  result = result.replace(/(from\s+["']\.\.?\/[^"']*?)\.ts(["'])/g, "$1.js$2");

  // 3. Replace Deno.env.get("X") → process.env.X
  //    The Worker handler provides env as a binding, but domain code that reads
  //    env directly (redis.ts, rfid-rollout.ts) needs an adapter. We set
  //    process.env from the Worker env bindings at startup.
  result = result.replace(/Deno\.env\.get\(["']([^"']+)["']\)/g, "process.env.$1");

  // 4. Remove jsr: imports (only in handler.ts, not domain, but safety)
  result = result.replace(/^import\s+["']jsr:[^"']+["'];?\s*$/gm, "");

  return result;
}

function copyDir(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  let fileCount = 0;

  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      fileCount += copyDir(srcPath, destPath);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      const content = readFileSync(srcPath, "utf-8");
      const rel = relative(ROOT, srcPath);
      const transformed = transform(content, rel);
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, transformed, "utf-8");
      console.log(`  ✓ ${relative(ROOT, destPath)}`);
      fileCount++;
    }
  }

  return fileCount;
}

console.log("Copying clinical-service domain code to Worker...\n");
console.log(`  Source: ${relative(ROOT, SRC)}`);
console.log(`  Target: ${relative(ROOT, DEST)}\n`);

const count = copyDir(SRC, DEST);
console.log(`\nCopied and transformed ${count} files.`);
console.log("\nReminder: review the copied files for any remaining Deno-specific patterns.");
