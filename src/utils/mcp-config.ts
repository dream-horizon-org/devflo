import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

interface McpServerEntry {
  command: string;
  args: string[];
}

interface McpConfig {
  mcpServers: Record<string, McpServerEntry>;
}

const MCP_CONFIG_FILENAME = "mcp.json";
const DEVFLO_SERVER_KEY = "devflo";

const DEVFLO_ENTRY: McpServerEntry = {
  command: "devflo",
  args: ["mcp-serve"],
};

function readMcpConfig(configPath: string): McpConfig {
  if (!existsSync(configPath)) {
    return { mcpServers: {} };
  }
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as McpConfig;
  } catch {
    return { mcpServers: {} };
  }
}

/**
 * Write devflo MCP server entry to the project's .cursor/mcp.json.
 * Merges with existing mcpServers so other project MCPs are preserved.
 */
export function writeLocalMcpConfig(projectDir: string): string {
  const configPath = join(projectDir, ".cursor", MCP_CONFIG_FILENAME);
  const config = readMcpConfig(configPath);

  if (!config.mcpServers) config.mcpServers = {};
  config.mcpServers[DEVFLO_SERVER_KEY] = DEVFLO_ENTRY;

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  return configPath;
}

/**
 * Remove devflo entry from a project-local .cursor/mcp.json if it exists,
 * to clean up old per-project configs from earlier versions.
 */
export function removeLocalMcpConfig(projectDir: string): void {
  const configPath = join(projectDir, ".cursor", MCP_CONFIG_FILENAME);
  if (!existsSync(configPath)) return;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as McpConfig;
    if (config.mcpServers && DEVFLO_SERVER_KEY in config.mcpServers) {
      delete config.mcpServers[DEVFLO_SERVER_KEY];
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    }
  } catch {
    // Non-critical — ignore parse errors
  }
}
