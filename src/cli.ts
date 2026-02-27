#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInit } from "./commands/init.js";
import { runUpdate } from "./commands/update.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("daisdlc")
  .description(
    "AI Software Development Lifecycle — install Cursor rules, agents, and skills into your project",
  )
  .version(pkg.version);

program
  .command("init")
  .description("Initialize AI SDLC in your project (copies .cursor files)")
  .argument("[path]", "target project directory", process.cwd())
  .action((targetPath: string) => {
    runInit(targetPath);
  });

program
  .command("update")
  .description("Update AI SDLC files to the latest version")
  .argument("[path]", "target project directory", process.cwd())
  .action((targetPath: string) => {
    runUpdate(targetPath);
  });

program.parse();
