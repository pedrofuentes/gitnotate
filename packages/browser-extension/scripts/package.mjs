#!/usr/bin/env node

import { createWriteStream, existsSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { readdirSync } from "node:fs";
import archiver from "archiver";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");

const REQUIRED_FILES = [
  "manifest.json",
  "content.js",
  "service-worker.js",
  "popup.js",
  "src/popup/popup.html",
  "assets/browser-extension.css",
  "assets/popup.css",
];

const REQUIRED_GLOBS = ["icons/*.png"];

function collectFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      results.push(relative(base, full).replace(/\\/g, "/"));
    }
  }
  return results;
}

function validateDist() {
  if (!existsSync(DIST)) {
    console.error("❌ dist/ directory not found. Run the build first.");
    process.exit(1);
  }

  const allFiles = collectFiles(DIST);
  const missing = [];

  for (const file of REQUIRED_FILES) {
    if (!allFiles.includes(file)) {
      missing.push(file);
    }
  }

  for (const glob of REQUIRED_GLOBS) {
    const dir = glob.split("/")[0];
    const ext = glob.split(".").pop();
    if (!allFiles.some((f) => f.startsWith(dir + "/") && f.endsWith("." + ext))) {
      missing.push(glob);
    }
  }

  if (missing.length > 0) {
    console.error("❌ Missing required files in dist/:");
    for (const f of missing) console.error(`   - ${f}`);
    process.exit(1);
  }

  console.log(`✅ Validated ${allFiles.length} files in dist/`);
  return allFiles;
}

function readVersion() {
  const manifestPath = join(DIST, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const version = manifest.version;
  if (!version) {
    console.error("❌ No version found in dist/manifest.json");
    process.exit(1);
  }
  return version;
}

async function createZip(version, fileCount) {
  const zipName = `gitnotate-v${version}.zip`;
  const zipPath = join(ROOT, zipName);

  const output = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on("close", () => {
      const size = statSync(zipPath).size;
      const sizeKB = (size / 1024).toFixed(1);
      console.log(`📦 ${zipName} — ${fileCount} files, ${sizeKB} KB`);
      resolve(zipPath);
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    // Add dist/ contents at zip root (not nested under dist/)
    archive.directory(DIST, false);
    archive.finalize();
  });
}

const files = validateDist();
const version = readVersion();
console.log(`📋 Packaging v${version}...`);
await createZip(version, files.length);
