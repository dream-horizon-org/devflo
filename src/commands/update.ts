import { resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  getTemplatesDir,
  getPackageVersion,
  readVersionMarker,
  writeVersionMarker,
  copyTemplates,
} from "../utils/copy.js";

export function runUpdate(targetPath?: string): void {
  const target = resolve(targetPath ?? process.cwd());
  const templatesDir = getTemplatesDir();

  if (!existsSync(templatesDir)) {
    console.error("Error: templates directory not found at", templatesDir);
    console.error("This is likely a packaging issue. Please reinstall daisdlc.");
    process.exit(1);
  }

  const version = getPackageVersion();
  const existing = readVersionMarker(target);

  if (existing?.version === version) {
    console.log(`Already up to date (v${version}).`);
    return;
  }

  if (existing) {
    console.log(`Updating daisdlc from v${existing.version} to v${version}\n`);
  } else {
    console.log(`No existing installation found. Installing v${version}\n`);
  }

  const copied = copyTemplates(templatesDir, target);
  writeVersionMarker(target, version);

  console.log(`Updated ${copied.length} files in .cursor/:\n`);
  for (const file of copied) {
    const relative = file.replace(target + "/", "");
    console.log(`  ${relative}`);
  }

  console.log(`\nVersion marker updated to v${version} in .cursor/.daisdlc`);
  console.log("\nDone! AI SDLC workflow files are up to date.");
}
