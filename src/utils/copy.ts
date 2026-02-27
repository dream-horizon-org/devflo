import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface VersionMarker {
  version: string;
  installedAt: string;
}

export function getPackageRoot(): string {
  return resolve(__dirname, "..", "..");
}

export function getTemplatesDir(): string {
  return join(getPackageRoot(), "templates", "cursor");
}

export function getPackageVersion(): string {
  const pkgPath = join(getPackageRoot(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
  return pkg.version;
}

export function readVersionMarker(targetDir: string): VersionMarker | null {
  const markerPath = join(targetDir, ".cursor", ".daisdlc");
  try {
    const raw = readFileSync(markerPath, "utf-8");
    return JSON.parse(raw) as VersionMarker;
  } catch {
    return null;
  }
}

export function writeVersionMarker(targetDir: string, version: string): void {
  const markerPath = join(targetDir, ".cursor", ".daisdlc");
  mkdirSync(dirname(markerPath), { recursive: true });
  const marker: VersionMarker = {
    version,
    installedAt: new Date().toISOString(),
  };
  writeFileSync(markerPath, JSON.stringify(marker, null, 2) + "\n", "utf-8");
}

function copyRecursive(src: string, dest: string): string[] {
  const copied: string[] = [];
  const entries = readdirSync(src, { withFileTypes: true });

  mkdirSync(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copied.push(...copyRecursive(srcPath, destPath));
    } else {
      copyFileSync(srcPath, destPath);
      copied.push(destPath);
    }
  }

  return copied;
}

export function copyTemplates(templatesDir: string, targetDir: string): string[] {
  const destCursor = join(targetDir, ".cursor");
  return copyRecursive(templatesDir, destCursor);
}
