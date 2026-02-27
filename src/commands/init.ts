import { resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  getTemplatesDir,
  getPackageVersion,
  readVersionMarker,
  writeVersionMarker,
  copyTemplates,
} from "../utils/copy.js";

export function runInit(targetPath?: string): void {
  const target = resolve(targetPath ?? process.cwd());
  const templatesDir = getTemplatesDir();

  if (!existsSync(templatesDir)) {
    console.error("Error: templates directory not found at", templatesDir);
    console.error("This is likely a packaging issue. Please reinstall daisdlc.");
    process.exit(1);
  }

  const version = getPackageVersion();
  const existing = readVersionMarker(target);

  if (existing) {
    console.log(`Existing daisdlc installation detected (v${existing.version}).`);
    console.log("Files will be overwritten with the current version.\n");
  }

  console.log(`Initializing daisdlc v${version} in ${target}\n`);

  const copied = copyTemplates(templatesDir, target);
  writeVersionMarker(target, version);

  console.log(`Copied ${copied.length} files into .cursor/:\n`);
  for (const file of copied) {
    const relative = file.replace(target + "/", "");
    console.log(`  ${relative}`);
  }

  console.log(`\nVersion marker written to .cursor/.daisdlc`);
  console.log("\nDone! Your project is set up with the AI SDLC workflow.");
}
