import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type Target = "cursor" | "claude-code";

export interface VersionMarker {
  version: string;
  installedAt: string;
  target: Target;
}

export function getPackageRoot(): string {
  return resolve(__dirname, "..", "..");
}

export function getTemplatesDir(target: Target): string {
  return join(getPackageRoot(), "templates", target);
}

export function getPackageVersion(): string {
  const pkgPath = join(getPackageRoot(), "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
  return pkg.version;
}

/**
 * Try both marker locations to detect which target was previously initialized.
 * Returns null if no marker exists in either location.
 */
export function detectTarget(targetDir: string): Target | null {
  const cursorMarker = join(targetDir, ".cursor", ".devflo");
  const claudeMarker = join(targetDir, ".claude", ".devflo");

  for (const [path, fallback] of [[cursorMarker, "cursor"], [claudeMarker, "claude-code"]] as const) {
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const marker = JSON.parse(raw) as Partial<VersionMarker>;
        return (marker.target as Target) ?? fallback;
      } catch {
        return fallback;
      }
    }
  }

  return null;
}

function markerPath(targetDir: string, target: Target): string {
  return target === "cursor"
    ? join(targetDir, ".cursor", ".devflo")
    : join(targetDir, ".claude", ".devflo");
}

export function readVersionMarker(targetDir: string, target: Target): VersionMarker | null {
  const mp = markerPath(targetDir, target);
  try {
    const raw = readFileSync(mp, "utf-8");
    const marker = JSON.parse(raw) as VersionMarker;
    if (!marker.target) marker.target = target;
    return marker;
  } catch {
    return null;
  }
}

export function writeVersionMarker(targetDir: string, target: Target, version: string): void {
  const mp = markerPath(targetDir, target);
  mkdirSync(dirname(mp), { recursive: true });
  const marker: VersionMarker = {
    version,
    target,
    installedAt: new Date().toISOString(),
  };
  writeFileSync(mp, JSON.stringify(marker, null, 2) + "\n", "utf-8");
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

export function copyTemplates(templatesDir: string, targetDir: string, target: Target): string[] {
  const copied: string[] = [];

  if (target === "cursor") {
    const destCursor = join(targetDir, ".cursor");
    copied.push(...copyRecursive(templatesDir, destCursor));
  } else {
    // CLAUDE.md goes to project root
    const claudeMdSrc = join(templatesDir, "CLAUDE.md");
    if (existsSync(claudeMdSrc)) {
      const claudeMdDest = join(targetDir, "CLAUDE.md");
      copyFileSync(claudeMdSrc, claudeMdDest);
      copied.push(claudeMdDest);
    }

    // agents/, commands/, skills/ go into .claude/
    for (const subdir of ["agents", "commands", "skills"]) {
      const srcPath = join(templatesDir, subdir);
      if (existsSync(srcPath)) {
        const destPath = join(targetDir, ".claude", subdir);
        copied.push(...copyRecursive(srcPath, destPath));
      }
    }
  }

  return copied;
}

/** Human-readable destination directory name for CLI output. */
export function destLabel(target: Target): string {
  return target === "cursor" ? ".cursor/" : ".claude/ + CLAUDE.md";
}
