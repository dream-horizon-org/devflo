import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  readdirSync,
  statSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

const MAX_ACTIVE_CHANGES = 20;

export interface ChangePhaseState {
  name: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  gateStatus?: string;
  subProgress?: { current: number; total: number; label: string };
}

export interface ChangeTaskItem {
  id: string;
  title: string;
  status: string;
  description?: string;
}

export interface ChangeEvent {
  id: string;
  timestamp: string;
  phase: string;
  agent: string;
  message: string;
  eventType: string;
}

export interface ChangeQAResults {
  verdict: string;
  findings: Array<{
    id: string;
    severity: string;
    description: string;
    file?: string;
    line?: number;
    fixType?: string;
  }>;
  summary?: string;
}

export interface ChangeTestSummary {
  commands: string[];
  suites: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  integrationResult?: string;
  notes?: string;
}

export interface ChangeContextData {
  name: string;
  classification: string;
  pipeline: string;
  workspacePath?: string;
  confidence?: string;
}

export interface PendingQuestionData {
  sessionId: string;
  questions: Array<{
    id: string;
    prompt: string;
    options?: Array<{ id: string; label: string; description?: string }>;
    allowMultiple?: boolean;
  }>;
  stale: boolean;
}

export interface PendingGateData {
  sessionId: string;
  gate: string;
  phaseName: string;
  summary?: string;
  stale: boolean;
}

export interface AnswerHistoryEntry {
  questionPrompt: string;
  answer: string;
}

export interface ChangeState {
  changeContext: ChangeContextData | null;
  phases: ChangePhaseState[];
  currentPhase: string;
  classification: string;
  changeName: string;
  confidence: string;
  tasks: ChangeTaskItem[];
  events: ChangeEvent[];
  qaResults: ChangeQAResults | null;
  testSummary: ChangeTestSummary | null;
  pendingQuestion: PendingQuestionData | null;
  pendingGate: PendingGateData | null;
  answerHistory: AnswerHistoryEntry[];
  /** Optional current file path (or display string) for agent activity. */
  currentFile?: string;
}

export interface Manifest {
  changeIds: string[];
  activeTabId: string | null;
}

const CANONICAL_PHASES = [
  "Classification",
  "PM",
  "Architect",
  "Developer",
  "QA",
  "Test Summary",
  "Cleanup",
] as const;

const PIPELINE_ACTIVE_PHASES: Record<string, Set<string>> = {
  "0→3→4→6":       new Set(["Classification", "Developer", "QA", "Cleanup"]),
  "0→1→3→4→5→6":   new Set(["Classification", "PM", "Developer", "QA", "Test Summary", "Cleanup"]),
  "0→1→2→3→4→5→6": new Set(["Classification", "PM", "Architect", "Developer", "QA", "Test Summary", "Cleanup"]),
};

export function initPhasesFromPipeline(pipeline: string): ChangePhaseState[] {
  const activeSet = PIPELINE_ACTIVE_PHASES[pipeline];
  return CANONICAL_PHASES.map((name) => ({
    name,
    status: activeSet && !activeSet.has(name) ? "skipped" : "pending",
  }));
}

/**
 * Upsert a single phase into changeState.phases.
 *
 * Rules:
 * - If the phase exists in the seeded list, update its status in place.
 * - If not found, reject with an error message (prevents typo-created ghost phases).
 * - When status is "active": auto-complete the previously active phase ONLY if it
 *   has no pending gate. If a gate is pending, the previous phase stays active.
 * - When a phase goes from "pending" directly to "completed", startedAt = completedAt.
 * - For backward transitions (REVISE), revert all phases between the target and the
 *   previously active phase back to "pending".
 *
 * Returns null on success, or an error string if the phase name is invalid.
 */
export function upsertPhase(
  changeState: ChangeState,
  phaseName: string,
  status: string,
): string | null {
  const idx = changeState.phases.findIndex((p) => p.name === phaseName);
  if (idx === -1) {
    return `Unknown phase "${phaseName}". Valid phases: ${changeState.phases.map((p) => p.name).join(", ")}`;
  }

  const now = new Date().toISOString();
  const target = changeState.phases[idx];

  if (status === "active") {
    const prevActiveIdx = changeState.phases.findIndex((p) => p.status === "active");
    const wasAlreadyActive = target.status === "active";

    if (prevActiveIdx !== -1 && prevActiveIdx !== idx) {
      const prev = changeState.phases[prevActiveIdx];

      if (prevActiveIdx < idx) {
        // Forward transition — auto-complete previous if no pending gate
        if (!prev.gateStatus || prev.gateStatus !== "pending") {
          prev.status = "completed";
          prev.completedAt = now;
          if (!prev.startedAt) prev.startedAt = now;
        }
      } else {
        // Backward transition (REVISE) — revert intermediate phases to pending
        for (let i = idx + 1; i <= prevActiveIdx; i++) {
          const phase = changeState.phases[i];
          if (phase.status === "active" || phase.status === "completed") {
            phase.status = "pending";
            delete phase.completedAt;
            delete phase.gateStatus;
            delete phase.subProgress;
          }
        }
      }
    }

    target.status = "active";
    if (!wasAlreadyActive || !target.startedAt) {
      target.startedAt = now;
    }
    delete target.completedAt;
    changeState.currentPhase = phaseName;
  } else if (status === "completed") {
    target.status = "completed";
    target.completedAt = now;
    if (!target.startedAt) target.startedAt = now;
  } else {
    target.status = status;
  }

  return null;
}

export function computeTaskProgress(changeState: ChangeState): void {
  if (changeState.tasks.length === 0) return;
  const completed = changeState.tasks.filter(
    (t) => t.status === "completed",
  ).length;
  const activePhase = changeState.phases.find((p) => p.status === "active");
  if (activePhase) {
    activePhase.subProgress = {
      current: completed,
      total: changeState.tasks.length,
      label: `Task ${completed}/${changeState.tasks.length}`,
    };
  }
}

export function createEmptyChangeState(): ChangeState {
  return {
    changeContext: null,
    phases: [],
    currentPhase: "",
    classification: "",
    changeName: "",
    confidence: "",
    tasks: [],
    events: [],
    qaResults: null,
    testSummary: null,
    pendingQuestion: null,
    pendingGate: null,
    answerHistory: [],
    currentFile: undefined,
  };
}

function stateDir(projectPath: string): string {
  return join(projectPath, ".cursor", "mcp", "state");
}

function archiveDir(projectPath: string): string {
  return join(stateDir(projectPath), "archive");
}

function manifestPath(projectPath: string): string {
  return join(stateDir(projectPath), "manifest.json");
}

function changeFilePath(projectPath: string, changeId: string): string {
  return join(stateDir(projectPath), `${changeId}.json`);
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function atomicWriteJson(filePath: string, data: unknown): void {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tmpPath, filePath);
}

function readManifest(projectPath: string): Manifest {
  const fp = manifestPath(projectPath);
  try {
    const raw = readFileSync(fp, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      changeIds: Array.isArray(parsed.changeIds) ? parsed.changeIds : [],
      activeTabId: parsed.activeTabId ?? null,
    };
  } catch {
    return { changeIds: [], activeTabId: null };
  }
}

function writeManifest(projectPath: string, manifest: Manifest): void {
  ensureDir(stateDir(projectPath));
  atomicWriteJson(manifestPath(projectPath), manifest);
}

export function loadState(projectPath: string): {
  changeStates: Map<string, ChangeState>;
  activeTabId: string | null;
} {
  const manifest = readManifest(projectPath);
  const changeStates = new Map<string, ChangeState>();
  const loadedIds: string[] = [];

  for (const changeId of manifest.changeIds) {
    const fp = changeFilePath(projectPath, changeId);
    try {
      const raw = readFileSync(fp, "utf-8");
      const state: ChangeState = JSON.parse(raw);
      if (state.pendingQuestion) state.pendingQuestion.stale = true;
      if (state.pendingGate) state.pendingGate.stale = true;
      changeStates.set(changeId, state);
      loadedIds.push(changeId);
    } catch {
      // Skip corrupt or missing files
    }
  }

  const activeTabId =
    manifest.activeTabId && loadedIds.includes(manifest.activeTabId)
      ? manifest.activeTabId
      : loadedIds[0] ?? null;

  const needsRepair =
    loadedIds.length !== manifest.changeIds.length ||
    activeTabId !== manifest.activeTabId;
  if (needsRepair) {
    ensureDir(stateDir(projectPath));
    writeManifest(projectPath, { changeIds: loadedIds, activeTabId });
  }

  return { changeStates, activeTabId };
}

export function saveChangeState(
  projectPath: string,
  changeId: string,
  state: ChangeState,
): void {
  ensureDir(stateDir(projectPath));

  atomicWriteJson(changeFilePath(projectPath, changeId), state);

  const manifest = readManifest(projectPath);
  if (!manifest.changeIds.includes(changeId)) {
    manifest.changeIds.push(changeId);
  }
  writeManifest(projectPath, manifest);

  archiveOldestIfNeeded(projectPath, changeId);
}

export function deleteChangeState(
  projectPath: string,
  changeId: string,
): void {
  const fp = changeFilePath(projectPath, changeId);
  try {
    unlinkSync(fp);
  } catch {
    // File may not exist
  }

  const manifest = readManifest(projectPath);
  manifest.changeIds = manifest.changeIds.filter((id) => id !== changeId);
  if (manifest.activeTabId === changeId) {
    manifest.activeTabId = manifest.changeIds[0] ?? null;
  }
  writeManifest(projectPath, manifest);
}

export function updateManifestActiveTab(
  projectPath: string,
  activeTabId: string | null,
): void {
  const manifest = readManifest(projectPath);
  manifest.activeTabId = activeTabId;
  writeManifest(projectPath, manifest);
}

export function archiveOldestIfNeeded(
  projectPath: string,
  excludeChangeId?: string,
): void {
  const manifest = readManifest(projectPath);
  if (manifest.changeIds.length <= MAX_ACTIVE_CHANGES) return;

  const dir = stateDir(projectPath);
  let oldestId: string | null = null;
  let oldestMtime = Infinity;

  for (const id of manifest.changeIds) {
    if (id === excludeChangeId) continue;
    try {
      const fp = join(dir, `${id}.json`);
      const st = statSync(fp);
      if (st.mtimeMs < oldestMtime) {
        oldestMtime = st.mtimeMs;
        oldestId = id;
      }
    } catch {
      // Missing file — candidate for removal from manifest
      oldestId = id;
      break;
    }
  }

  if (!oldestId) return;

  const archDir = archiveDir(projectPath);
  ensureDir(archDir);

  const srcPath = changeFilePath(projectPath, oldestId);
  const destPath = join(archDir, `${oldestId}.json`);
  if (existsSync(srcPath)) {
    try {
      const content = readFileSync(srcPath, "utf-8");
      writeFileSync(destPath, content, "utf-8");
      unlinkSync(srcPath);
    } catch {
      // Best effort
    }
  }

  manifest.changeIds = manifest.changeIds.filter((id) => id !== oldestId);
  if (manifest.activeTabId === oldestId) {
    manifest.activeTabId = manifest.changeIds[0] ?? null;
  }
  writeManifest(projectPath, manifest);
}
