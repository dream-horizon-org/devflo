import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createStaticServer } from "../http.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Server } from "node:http";

describe("GET /api/files/list", () => {
  let tempDir: string;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "devflo-http-list-"));
    writeFileSync(join(tempDir, "index.html"), "<!DOCTYPE html><html></html>", "utf-8");
    writeFileSync(join(tempDir, "proposal.md"), "# Proposal\n", "utf-8");
    writeFileSync(join(tempDir, "design.md"), "# Design\n", "utf-8");

    const staticServer = createStaticServer(tempDir, () => tempDir);
    await new Promise<void>((resolve) => {
      server = staticServer.listen(0, "127.0.0.1", () => resolve());
    });
    const port = (server.address() as { port: number }).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(() => {
    server?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns files as array of objects with name and mtime (ISO string)", async () => {
    const res = await fetch(`${baseUrl}/api/files/list?dir=.`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("dir", ".");
    expect(Array.isArray(data.files)).toBe(true);
    expect(data.files.length).toBeGreaterThanOrEqual(2);

    for (const file of data.files) {
      expect(file).toHaveProperty("name");
      expect(typeof file.name).toBe("string");
      expect(file).toHaveProperty("mtime");
      expect(typeof file.mtime).toBe("string");
      expect(() => new Date(file.mtime).toISOString()).not.toThrow();
      expect(new Date(file.mtime).toISOString()).toBe(file.mtime);
    }

    const names = data.files.map((f: { name: string }) => f.name);
    expect(names).toContain("proposal.md");
    expect(names).toContain("design.md");
  });

  it("returns 403 for path traversal attempt", async () => {
    const res = await fetch(`${baseUrl}/api/files/list?dir=..`);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(data.error).toMatch(/traversal|not allowed/i);
  });

  it("returns 400 when dir query is missing", async () => {
    const res = await fetch(`${baseUrl}/api/files/list`);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/project", () => {
  let tempDir: string;
  let server: Server;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "devflo-http-project-"));
    writeFileSync(join(tempDir, "index.html"), "<!DOCTYPE html><html></html>", "utf-8");
    const staticServer = createStaticServer(tempDir, () => tempDir);
    await new Promise<void>((resolve) => {
      server = staticServer.listen(0, "127.0.0.1", () => resolve());
    });
  });

  afterEach(() => {
    server?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns projectPath when getProjectPath is provided", async () => {
    const port = (server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/project`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("projectPath", tempDir);
  });
});
