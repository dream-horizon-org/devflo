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
  destLabel,
} from "../utils/copy.js";

async function resolveTarget(preselected?: string): Promise<Target> {
  if (preselected === "cursor" || preselected === "claude-code") return preselected;

  if (preselected) {
    console.error(`Invalid target "${preselected}". Must be "cursor" or "claude-code".`);
    process.exit(1);
  }

  return select<Target>({
    message: "Select your AI coding tool:",
    choices: [
      { name: "Cursor IDE", value: "cursor" },
      { name: "Claude Code", value: "claude-code" },
    ],
    default: "cursor",
  });
}

export async function runInit(targetPath?: string, preselectedTarget?: string): Promise<void> {
  const projectDir = resolve(targetPath ?? process.cwd());
  const target = await resolveTarget(preselectedTarget);
  const templatesDir = getTemplatesDir(target);

  if (!existsSync(templatesDir)) {
    console.error("Error: templates directory not found at", templatesDir);
    console.error("This is likely a packaging issue. Please reinstall devflo.");
    process.exit(1);
  }

  const version = getPackageVersion();
  const existing = readVersionMarker(projectDir, target);

  if (existing) {
    console.log(`Existing devflo installation detected (v${existing.version}, target: ${existing.target}).`);
    console.log("Files will be overwritten with the current version.\n");
  }

  console.log(`Initializing devflo v${version} for ${target} in ${projectDir}\n`);

  const copied = copyTemplates(templatesDir, projectDir, target);
  writeVersionMarker(projectDir, target, version);

  const label = destLabel(target);
  console.log(`Copied ${copied.length} files into ${label}:\n`);
  for (const file of copied) {
    const relative = file.replace(projectDir + "/", "");
    console.log(`  ${relative}`);
  }

  const markerLoc = target === "cursor" ? ".cursor/.devflo" : ".claude/.devflo";
  console.log(`\nVersion marker written to ${markerLoc}`);
  console.log("\nDone! Your project is set up with the AI SDLC workflow.");
}
