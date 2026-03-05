import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { select } from "@inquirer/prompts";
import {
  type Target,
  getTemplatesDir,
  getPackageVersion,
  readVersionMarker,
  writeVersionMarker,
  copyTemplates,
  detectTarget,
  destLabel,
} from "../utils/copy.js";

async function resolveTargetForUpdate(projectDir: string, preselected?: string): Promise<Target> {
  if (preselected === "cursor" || preselected === "claude-code") return preselected;

  if (preselected) {
    console.error(`Invalid target "${preselected}". Must be "cursor" or "claude-code".`);
    process.exit(1);
  }

  const detected = detectTarget(projectDir);
  if (detected) return detected;

  // No existing marker — ask the user
  return select<Target>({
    message: "No existing installation detected. Select your AI coding tool:",
    choices: [
      { name: "Cursor IDE", value: "cursor" },
      { name: "Claude Code", value: "claude-code" },
    ],
    default: "cursor",
  });
}

export async function runUpdate(targetPath?: string, preselectedTarget?: string): Promise<void> {
  const projectDir = resolve(targetPath ?? process.cwd());
  const target = await resolveTargetForUpdate(projectDir, preselectedTarget);
  const templatesDir = getTemplatesDir(target);

  if (!existsSync(templatesDir)) {
    console.error("Error: templates directory not found at", templatesDir);
    console.error("This is likely a packaging issue. Please reinstall daisdlc.");
    process.exit(1);
  }

  const version = getPackageVersion();
  const existing = readVersionMarker(projectDir, target);

  if (existing?.version === version) {
    console.log(`Already up to date (v${version}, target: ${target}).`);
    return;
  }

  if (existing) {
    console.log(`Updating daisdlc from v${existing.version} to v${version} (target: ${target})\n`);
  } else {
    console.log(`No existing installation found. Installing v${version} for ${target}\n`);
  }

  const copied = copyTemplates(templatesDir, projectDir, target);
  writeVersionMarker(projectDir, target, version);

  const label = destLabel(target);
  console.log(`Updated ${copied.length} files in ${label}:\n`);
  for (const file of copied) {
    const relative = file.replace(projectDir + "/", "");
    console.log(`  ${relative}`);
  }

  const markerLoc = target === "cursor" ? ".cursor/.daisdlc" : ".claude/.daisdlc";
  console.log(`\nVersion marker updated to v${version} in ${markerLoc}`);
  console.log("\nDone! AI SDLC workflow files are up to date.");
}
