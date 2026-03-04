import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

function resolveOpenSpecBin(): string {
  const require = createRequire(import.meta.url);
  // Resolve any file inside the package to locate the package directory.
  // The main export is always available even when package.json isn't exported.
  const mainPath = require.resolve("@fission-ai/openspec");
  // Walk up from dist/index.js to the package root, then read its package.json
  // to determine the bin path dynamically.
  let dir = dirname(mainPath);
  while (dir !== dirname(dir)) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(dir, "package.json"), "utf-8"),
      ) as { name?: string; bin?: Record<string, string> };
      if (pkg.name === "@fission-ai/openspec") {
        const binRelative = pkg.bin?.["openspec"];
        if (!binRelative) {
          throw new Error(
            "Could not find 'openspec' bin entry in @fission-ai/openspec package.json",
          );
        }
        return join(dir, binRelative);
      }
    } catch {
      // No package.json here or wrong package — keep walking up.
    }
    dir = dirname(dir);
  }
  throw new Error(
    "Could not locate @fission-ai/openspec package root. Is it installed?",
  );
}

export function runBundledOpenSpec(args: string[]): void {
  const bin = resolveOpenSpecBin();
  try {
    execFileSync(process.execPath, [bin, ...args], {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
    ) {
      process.exit((err as { status: number }).status);
    }
    throw err;
  }
}
