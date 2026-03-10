import { createServer } from "node:net";
import { request } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const PORT_RANGE_START = 19000;
const PORT_RANGE_SIZE = 10000;
const MAX_PORT_ATTEMPTS = 50;

export function getProjectPort(projectPath: string): number {
  let hash = 0;
  for (const char of projectPath) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  return PORT_RANGE_START + (Math.abs(hash) % PORT_RANGE_SIZE);
}

export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer();
    tester.once("error", () => resolve(false));
    tester.listen(port, "127.0.0.1", () => {
      tester.close(() => resolve(true));
    });
  });
}

export function portFilePath(projectPath: string): string {
  return join(projectPath, ".cursor", "mcp", ".devflo-port");
}

export function writePortFile(projectPath: string, port: number): void {
  const filePath = portFilePath(projectPath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, String(port), "utf-8");
}

export function readPortFile(projectPath: string): number | null {
  try {
    const raw = readFileSync(portFilePath(projectPath), "utf-8").trim();
    const port = parseInt(raw, 10);
    return Number.isNaN(port) ? null : port;
  } catch {
    return null;
  }
}

/**
 * Check whether a DevFlo dashboard server is already listening on the given port
 * by hitting its /health endpoint. Resolves true if the server responds with
 * `{ server: "devflo" }`, false otherwise (timeout 1 s).
 */
export function isDevfloServerAlive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 1000);
    const req = request(
      { hostname: "127.0.0.1", port, path: "/health", method: "GET", timeout: 1000 },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        res.on("end", () => {
          clearTimeout(timer);
          try {
            const parsed = JSON.parse(body);
            resolve(parsed?.server === "devflo");
          } catch {
            resolve(false);
          }
        });
      },
    );
    req.on("error", () => { clearTimeout(timer); resolve(false); });
    req.on("timeout", () => { req.destroy(); clearTimeout(timer); resolve(false); });
    req.end();
  });
}

export async function acquirePort(projectPath: string): Promise<number> {
  const preferred = getProjectPort(projectPath);

  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset++) {
    const port = preferred + offset;
    if (await isPortFree(port)) {
      writePortFile(projectPath, port);
      return port;
    }
  }

  // Last resort: let the OS pick
  return 0;
}
