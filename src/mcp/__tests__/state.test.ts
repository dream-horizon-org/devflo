import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadState,
  saveChangeState,
  deleteChangeState,
  archiveOldestIfNeeded,
  createEmptyChangeState,
  initPhasesFromPipeline,
  upsertPhase,
  type ChangeState,
} from "../state.js";

let tempDir: string;

function stateDir(): string {
  return join(tempDir, ".cursor", "mcp", "state");
}

function manifestPath(): string {
  return join(stateDir(), "manifest.json");
}

function changeFilePath(changeId: string): string {
  return join(stateDir(), `${changeId}.json`);
}

function readManifest(): { changeIds: string[]; activeTabId: string | null } {
  return JSON.parse(readFileSync(manifestPath(), "utf-8"));
}

function makeState(name: string): ChangeState {
  const state = createEmptyChangeState();
  state.changeName = name;
  state.changeContext = {
    name,
    classification: "New Feature",
    pipeline: "full",
  };
  return state;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "devflo-state-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("loadState", () => {
  it("returns empty state when no manifest exists", () => {
    const result = loadState(tempDir);
    expect(result.changeStates.size).toBe(0);
    expect(result.activeTabId).toBeNull();
  });

  it("loads changes from manifest and marks pending as stale", () => {
    const dir = stateDir();
    mkdirSync(dir, { recursive: true });

    const state = makeState("test-change");
    state.pendingQuestion = {
      sessionId: "q-1",
      questions: [{ id: "q1", prompt: "Test?" }],
      stale: false,
    };
    state.pendingGate = {
      sessionId: "g-1",
      gate: "A",
      phaseName: "PM",
      stale: false,
    };

    writeFileSync(join(dir, "test-change.json"), JSON.stringify(state), "utf-8");
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({
      changeIds: ["test-change"],
      activeTabId: "test-change",
    }), "utf-8");

    const result = loadState(tempDir);
    expect(result.changeStates.size).toBe(1);
    expect(result.activeTabId).toBe("test-change");

    const loaded = result.changeStates.get("test-change")!;
    expect(loaded.pendingQuestion?.stale).toBe(true);
    expect(loaded.pendingGate?.stale).toBe(true);
  });

  it("skips missing change files gracefully", () => {
    const dir = stateDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({
      changeIds: ["exists", "missing"],
      activeTabId: "exists",
    }), "utf-8");
    writeFileSync(join(dir, "exists.json"), JSON.stringify(makeState("exists")), "utf-8");

    const result = loadState(tempDir);
    expect(result.changeStates.size).toBe(1);
    expect(result.changeStates.has("exists")).toBe(true);
    expect(result.changeStates.has("missing")).toBe(false);
  });

  it("repairs manifest when activeTabId points to missing file and returns valid activeTabId", () => {
    const dir = stateDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({
      changeIds: ["a", "b"],
      activeTabId: "a",
    }), "utf-8");
    writeFileSync(join(dir, "b.json"), JSON.stringify(makeState("b")), "utf-8");
    // "a.json" is missing

    const result = loadState(tempDir);
    expect(result.changeStates.size).toBe(1);
    expect(result.changeStates.has("b")).toBe(true);
    expect(result.activeTabId).toBe("b");

    const manifest = readManifest();
    expect(manifest.changeIds).toEqual(["b"]);
    expect(manifest.activeTabId).toBe("b");
  });

  it("repairs manifest when file is corrupt and writes back consistent manifest", () => {
    const dir = stateDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({
      changeIds: ["good", "corrupt"],
      activeTabId: "good",
    }), "utf-8");
    writeFileSync(join(dir, "good.json"), JSON.stringify(makeState("good")), "utf-8");
    writeFileSync(join(dir, "corrupt.json"), "not valid json", "utf-8");

    const result = loadState(tempDir);
    expect(result.changeStates.size).toBe(1);
    expect(result.activeTabId).toBe("good");

    const manifest = readManifest();
    expect(manifest.changeIds).toEqual(["good"]);
    expect(manifest.activeTabId).toBe("good");
  });
});

describe("saveChangeState", () => {
  it("creates state directory and files", () => {
    const state = makeState("my-change");
    saveChangeState(tempDir, "my-change", state);

    expect(existsSync(changeFilePath("my-change"))).toBe(true);
    expect(existsSync(manifestPath())).toBe(true);

    const manifest = readManifest();
    expect(manifest.changeIds).toContain("my-change");
  });

  it("uses atomic write (no .tmp file left behind)", () => {
    saveChangeState(tempDir, "atomic-test", makeState("atomic-test"));
    expect(existsSync(changeFilePath("atomic-test") + ".tmp")).toBe(false);
    expect(existsSync(changeFilePath("atomic-test"))).toBe(true);
  });

  it("does not duplicate changeId in manifest on repeated saves", () => {
    const state = makeState("dup-test");
    saveChangeState(tempDir, "dup-test", state);
    saveChangeState(tempDir, "dup-test", state);
    saveChangeState(tempDir, "dup-test", state);

    const manifest = readManifest();
    expect(manifest.changeIds.filter((id: string) => id === "dup-test").length).toBe(1);
  });
});

describe("deleteChangeState", () => {
  it("removes state file and manifest entry", () => {
    saveChangeState(tempDir, "to-delete", makeState("to-delete"));
    expect(existsSync(changeFilePath("to-delete"))).toBe(true);

    deleteChangeState(tempDir, "to-delete");
    expect(existsSync(changeFilePath("to-delete"))).toBe(false);

    const manifest = readManifest();
    expect(manifest.changeIds).not.toContain("to-delete");
  });

  it("updates activeTabId when deleting the active tab", () => {
    saveChangeState(tempDir, "a", makeState("a"));
    saveChangeState(tempDir, "b", makeState("b"));

    const dir = stateDir();
    const manifest = JSON.parse(readFileSync(manifestPath(), "utf-8"));
    manifest.activeTabId = "a";
    writeFileSync(manifestPath(), JSON.stringify(manifest), "utf-8");

    deleteChangeState(tempDir, "a");
    const updated = readManifest();
    expect(updated.activeTabId).toBe("b");
  });

  it("handles deleting non-existent change gracefully", () => {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(manifestPath(), JSON.stringify({ changeIds: [], activeTabId: null }), "utf-8");
    expect(() => deleteChangeState(tempDir, "nonexistent")).not.toThrow();
  });
});

describe("currentFile (agent activity)", () => {
  it("round-trips in save and load", () => {
    const state = makeState("agent-activity-change");
    state.currentFile = "src/mcp/state.ts";
    saveChangeState(tempDir, "agent-activity-change", state);

    const { changeStates } = loadState(tempDir);
    const loaded = changeStates.get("agent-activity-change")!;
    expect(loaded.currentFile).toBe("src/mcp/state.ts");
  });

  it("is undefined when not set (createEmptyChangeState and after load)", () => {
    const state = makeState("no-current-file");
    expect(state.currentFile).toBeUndefined();
    saveChangeState(tempDir, "no-current-file", state);

    const { changeStates } = loadState(tempDir);
    const loaded = changeStates.get("no-current-file")!;
    expect(loaded.currentFile).toBeUndefined();
  });
});

describe("initPhasesFromPipeline", () => {
  it("seeds all 7 canonical phases for full pipeline", () => {
    const phases = initPhasesFromPipeline("0→1→2→3→4→5→6");
    expect(phases).toHaveLength(7);
    expect(phases.map((p) => p.name)).toEqual([
      "Classification", "PM", "Architect", "Developer", "QA", "Test Summary", "Cleanup",
    ]);
    expect(phases.every((p) => p.status === "pending")).toBe(true);
  });

  it("marks Architect as skipped for Bug Fix pipeline", () => {
    const phases = initPhasesFromPipeline("0→1→3→4→5→6");
    expect(phases).toHaveLength(7);
    const architect = phases.find((p) => p.name === "Architect")!;
    expect(architect.status).toBe("skipped");
    const pm = phases.find((p) => p.name === "PM")!;
    expect(pm.status).toBe("pending");
  });

  it("marks PM, Architect, Test Summary as skipped for Trivial pipeline", () => {
    const phases = initPhasesFromPipeline("0→3→4→6");
    const skipped = phases.filter((p) => p.status === "skipped").map((p) => p.name);
    expect(skipped).toEqual(["PM", "Architect", "Test Summary"]);
    const pending = phases.filter((p) => p.status === "pending").map((p) => p.name);
    expect(pending).toEqual(["Classification", "Developer", "QA", "Cleanup"]);
  });

  it("falls back to all-pending for unknown pipeline string", () => {
    const phases = initPhasesFromPipeline("custom-unknown");
    expect(phases).toHaveLength(7);
    expect(phases.every((p) => p.status === "pending")).toBe(true);
  });
});

describe("upsertPhase", () => {
  function makeSeededState(): ChangeState {
    const state = createEmptyChangeState();
    state.phases = initPhasesFromPipeline("0→1→2→3→4→5→6");
    return state;
  }

  it("rejects unknown phase names", () => {
    const state = makeSeededState();
    const err = upsertPhase(state, "Nonexistent", "active");
    expect(err).toContain("Unknown phase");
  });

  it("activates a phase and sets startedAt", () => {
    const state = makeSeededState();
    const err = upsertPhase(state, "Classification", "active");
    expect(err).toBeNull();
    const phase = state.phases.find((p) => p.name === "Classification")!;
    expect(phase.status).toBe("active");
    expect(phase.startedAt).toBeDefined();
    expect(state.currentPhase).toBe("Classification");
  });

  it("auto-completes the previously active phase on forward transition", () => {
    const state = makeSeededState();
    upsertPhase(state, "Classification", "active");
    upsertPhase(state, "PM", "active");

    const classification = state.phases.find((p) => p.name === "Classification")!;
    expect(classification.status).toBe("completed");
    expect(classification.completedAt).toBeDefined();

    const pm = state.phases.find((p) => p.name === "PM")!;
    expect(pm.status).toBe("active");
    expect(state.currentPhase).toBe("PM");
  });

  it("does NOT auto-complete a phase with a pending gate", () => {
    const state = makeSeededState();
    upsertPhase(state, "PM", "active");

    const pm = state.phases.find((p) => p.name === "PM")!;
    pm.gateStatus = "pending";

    upsertPhase(state, "Architect", "active");

    expect(pm.status).toBe("active");
    expect(pm.gateStatus).toBe("pending");
  });

  it("completes a phase and sets completedAt", () => {
    const state = makeSeededState();
    upsertPhase(state, "Classification", "active");
    upsertPhase(state, "Classification", "completed");

    const phase = state.phases.find((p) => p.name === "Classification")!;
    expect(phase.status).toBe("completed");
    expect(phase.completedAt).toBeDefined();
    expect(phase.startedAt).toBeDefined();
  });

  it("sets startedAt = completedAt when going pending → completed directly", () => {
    const state = makeSeededState();
    upsertPhase(state, "Classification", "completed");

    const phase = state.phases.find((p) => p.name === "Classification")!;
    expect(phase.status).toBe("completed");
    expect(phase.startedAt).toBe(phase.completedAt);
  });

  it("reverts intermediate phases on backward transition", () => {
    const state = makeSeededState();
    upsertPhase(state, "Classification", "completed");
    upsertPhase(state, "PM", "completed");
    upsertPhase(state, "Architect", "completed");
    upsertPhase(state, "Developer", "active");

    upsertPhase(state, "Architect", "active");

    const dev = state.phases.find((p) => p.name === "Developer")!;
    expect(dev.status).toBe("pending");
    expect(dev.completedAt).toBeUndefined();

    const architect = state.phases.find((p) => p.name === "Architect")!;
    expect(architect.status).toBe("active");
    expect(state.currentPhase).toBe("Architect");
  });

  it("preserves phases that are not updated", () => {
    const state = makeSeededState();
    upsertPhase(state, "Classification", "completed");
    upsertPhase(state, "PM", "active");

    const qa = state.phases.find((p) => p.name === "QA")!;
    expect(qa.status).toBe("pending");
    const cleanup = state.phases.find((p) => p.name === "Cleanup")!;
    expect(cleanup.status).toBe("pending");
    expect(state.phases).toHaveLength(7);
  });

  it("clears gateStatus and subProgress on backward revert", () => {
    const state = makeSeededState();
    upsertPhase(state, "Classification", "completed");
    upsertPhase(state, "PM", "active");

    const pm = state.phases.find((p) => p.name === "PM")!;
    pm.gateStatus = "approved";
    pm.subProgress = { current: 1, total: 2, label: "test" };

    upsertPhase(state, "PM", "completed");
    upsertPhase(state, "Architect", "active");
    upsertPhase(state, "Architect", "completed");
    upsertPhase(state, "Developer", "active");

    // REVISE back to PM
    upsertPhase(state, "PM", "active");

    const architect = state.phases.find((p) => p.name === "Architect")!;
    expect(architect.status).toBe("pending");
    expect(architect.gateStatus).toBeUndefined();

    const dev = state.phases.find((p) => p.name === "Developer")!;
    expect(dev.status).toBe("pending");
    expect(dev.subProgress).toBeUndefined();
  });
});

describe("archiveOldestIfNeeded", () => {
  it("does nothing when under the limit", () => {
    for (let i = 0; i < 5; i++) {
      saveChangeState(tempDir, `change-${i}`, makeState(`change-${i}`));
    }
    archiveOldestIfNeeded(tempDir);
    expect(readManifest().changeIds.length).toBe(5);
  });

  it("archives oldest when over 20 changes", () => {
    for (let i = 0; i < 21; i++) {
      const state = makeState(`change-${String(i).padStart(2, "0")}`);
      saveChangeState(tempDir, `change-${String(i).padStart(2, "0")}`, state);
    }

    const manifest = readManifest();
    expect(manifest.changeIds.length).toBeLessThanOrEqual(20);

    const archiveDir = join(stateDir(), "archive");
    expect(existsSync(archiveDir)).toBe(true);
  });
});
