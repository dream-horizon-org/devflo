import { resolve } from "node:path";
import { readPortFile } from "../mcp/port.js";
import { openDashboard } from "../mcp/launcher.js";

export function runDashboard(targetPath?: string, headless = false): void {
  const projectDir = resolve(targetPath ?? process.cwd());
  const port = readPortFile(projectDir);

  if (!port) {
    console.error("DevFlo MCP server is not running.");
    console.error("Open the project in Cursor first — the server starts automatically.");
    process.exit(1);
  }

  const url = `http://localhost:${port}`;
  if (headless) {
    process.env.DEVFLO_HEADLESS = "1";
  }
  if (!headless) {
    console.log(`Opening DevFlo Dashboard at ${url}`);
  }
  openDashboard(url);
}
