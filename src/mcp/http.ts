import { createServer as createHttpServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const ALLOWED_EXTENSIONS = new Set([".md", ".yaml", ".yml", ".json", ".txt", ".toml"]);

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  setCorsHeaders(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function handleFileRead(req: IncomingMessage, res: ServerResponse, projectPath: string): boolean {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/api/files" && req.method === "GET") {
    const relPath = url.searchParams.get("path");
    if (!relPath) {
      sendJson(res, 400, { error: "Missing 'path' query parameter" });
      return true;
    }

    const fullPath = resolve(join(projectPath, relPath));
    if (!fullPath.startsWith(resolve(projectPath))) {
      sendJson(res, 403, { error: "Path traversal not allowed" });
      return true;
    }

    const ext = extname(fullPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      sendJson(res, 403, { error: `File type '${ext}' not allowed` });
      return true;
    }

    if (!existsSync(fullPath)) {
      sendJson(res, 404, { error: "File not found" });
      return true;
    }

    try {
      const content = readFileSync(fullPath, "utf-8");
      sendJson(res, 200, { path: relPath, content });
    } catch {
      sendJson(res, 500, { error: "Failed to read file" });
    }
    return true;
  }

  if (url.pathname === "/api/files/list" && req.method === "GET") {
    const dirPath = url.searchParams.get("dir");
    if (!dirPath) {
      sendJson(res, 400, { error: "Missing 'dir' query parameter" });
      return true;
    }

    const fullDir = resolve(join(projectPath, dirPath));
    if (!fullDir.startsWith(resolve(projectPath))) {
      sendJson(res, 403, { error: "Path traversal not allowed" });
      return true;
    }

    if (!existsSync(fullDir)) {
      sendJson(res, 404, { error: "Directory not found" });
      return true;
    }

    try {
      const entries = readdirSync(fullDir)
        .map((name): { name: string; mtime: string } | null => {
          const fp = join(fullDir, name);
          const ext = extname(name).toLowerCase();
          let stat;
          try {
            stat = statSync(fp);
          } catch {
            return null;
          }
          if (!stat.isFile() || !ALLOWED_EXTENSIONS.has(ext)) return null;
          return { name, mtime: stat.mtime.toISOString() };
        })
        .filter((x): x is { name: string; mtime: string } => x !== null);
      sendJson(res, 200, { dir: dirPath, files: entries });
    } catch {
      sendJson(res, 500, { error: "Failed to list directory" });
    }
    return true;
  }

  if (url.pathname.startsWith("/api/") && req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
}

export function createStaticServer(uiDir: string, getProjectPath?: () => string): Server {
  return createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health" && req.method === "GET") {
      sendJson(res, 200, { status: "ok", server: "devflo" });
      return;
    }

    if (url.pathname === "/api/project" && req.method === "GET") {
      const path = getProjectPath?.();
      sendJson(res, 200, { projectPath: path ?? null });
      return;
    }

    const projectPath = getProjectPath?.();
    if (projectPath && handleFileRead(req, res, projectPath)) {
      return;
    }

    let urlPath = req.url ?? "/";
    if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

    const cleanPath = urlPath.split("?")[0];
    const filePath = resolve(join(uiDir, cleanPath));

    if (!filePath.startsWith(resolve(uiDir))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (!existsSync(filePath)) {
      const indexPath = join(uiDir, "index.html");
      if (existsSync(indexPath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(readFileSync(indexPath));
        return;
      }
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(readFileSync(filePath));
  });
}
