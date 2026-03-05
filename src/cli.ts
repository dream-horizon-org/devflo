#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInit } from "./commands/init.js";
import { runUpdate } from "./commands/update.js";
import { registerSpecCommand } from "./commands/spec.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("devflo")
  .description(
    "AI Software Development Lifecycle — install rules, agents, and skills for Cursor or Claude Code",
  )
  .version(pkg.version);

program
  .command("init")
  .description("Initialize AI SDLC in your project")
  .argument("[path]", "target project directory", process.cwd())
  .option("-t, --target <target>", "target IDE: cursor or claude-code (skips interactive prompt)")
  .action(async (targetPath: string, opts: { target?: string }) => {
    await runInit(targetPath, opts.target);
  });

program
  .command("update")
  .description("Update AI SDLC files to the latest version")
  .argument("[path]", "target project directory", process.cwd())
  .option("-t, --target <target>", "target IDE: cursor or claude-code (overrides auto-detect)")
  .action(async (targetPath: string, opts: { target?: string }) => {
    await runUpdate(targetPath, opts.target);
  });

registerSpecCommand(program);

program.parse();
