import { getChromePath } from "chrome-launcher";
import { spawn } from "node:child_process";
import { platform } from "node:os";

let browserOpened = false;

function isHeadless(): boolean {
  return (
    process.env.DEVFLO_HEADLESS === "1" ||
    process.env.DEVFLO_NO_BROWSER === "1"
  );
}

export function hasBrowserOpened(): boolean {
  return browserOpened;
}

/**
 * Open the dashboard URL in a Chromium-based browser in app mode.
 *
 * Uses chrome-launcher for cross-platform Chrome/Chromium discovery,
 * then spawns the binary directly with --app for a chromeless window.
 * Falls back to the system default browser if no Chromium is found.
 *
 * The guard flag is set synchronously before any async work so
 * concurrent callers never open duplicate windows.
 */
export function openDashboard(url: string): void {
  if (browserOpened) return;
  browserOpened = true;

  if (isHeadless()) {
    console.error(`[DevFlo] Headless mode: open manually → ${url}`);
    return;
  }

  launchBrowser(url).catch(() => {
    browserOpened = false;
    console.error("[DevFlo] Could not open browser. Open the dashboard manually:");
    console.error("  %s", url);
  });
}

async function launchBrowser(url: string): Promise<void> {
  try {
    const chromePath = getChromePath();
    const proc = spawn(chromePath, [`--app=${url}`, "--window-size=1050,750"], {
      detached: true,
      stdio: "ignore",
    });
    proc.unref();
    return;
  } catch {
    // Chrome/Chromium not found — fall through to system default
  }

  openWithSystemDefault(url);
}

function openWithSystemDefault(url: string): void {
  const os = platform();
  let cmd: string;
  let args: string[];

  if (os === "darwin") {
    cmd = "open";
    args = [url];
  } else if (os === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }

  const proc = spawn(cmd, args, { detached: true, stdio: "ignore" });
  proc.unref();
}
