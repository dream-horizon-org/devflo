import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { acquirePort, readPortFile, writePortFile, isDevfloServerAlive } from "./port.js";
import { openDashboard, hasBrowserOpened } from "./launcher.js";
import { createStaticServer } from "./http.js";
import {
  loadState,
  saveChangeState,
  deleteChangeState,
  updateManifestActiveTab,
  createEmptyChangeState,
  upsertPhase,
  initPhasesFromPipeline,
  computeTaskProgress,
  type ChangeState,
} from "./state.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, "..", "..");

const QUESTION_TIMEOUT_MS = 10 * 60 * 1000;
const GATE_TIMEOUT_MS = 30 * 60 * 1000;

// --- State ---

interface PendingPromise<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const wsClients = new Set<WebSocket>();
let serverPort = 0;
let projectPath = "";

const changeStates = new Map<string, ChangeState>();
let activeChangeId: string | null = null;

const pendingQuestions = new Map<string, PendingPromise<Record<string, string | string[]>>>();
const pendingGates = new Map<string, PendingPromise<{ action: string; feedback?: string }>>();

function getActiveState(): ChangeState | null {
  if (!activeChangeId) return null;
  return changeStates.get(activeChangeId) ?? null;
}

function getOrCreateChange(changeId: string): ChangeState {
  let state = changeStates.get(changeId);
  if (!state) {
    state = createEmptyChangeState();
    changeStates.set(changeId, state);
  }
  return state;
}

let lastUpdateTime: string | null = null;

function persistChange(changeId: string): void {
  const state = changeStates.get(changeId);
  if (state && projectPath) {
    saveChangeState(projectPath, changeId, state);
    lastUpdateTime = new Date().toISOString();
  }
}

function buildFullDump(): object {
  const tabs: Record<string, object> = {};
  for (const [id, state] of changeStates) {
    tabs[id] = {
      changeContext: state.changeContext,
      phases: state.phases,
      currentPhase: state.currentPhase,
      classification: state.changeContext?.classification ?? state.classification,
      changeName: state.changeContext?.name ?? state.changeName,
      confidence: state.changeContext?.confidence ?? state.confidence,
      tasks: state.tasks,
      events: state.events,
      qaResults: state.qaResults,
      testSummary: state.testSummary,
      questionBatch: state.pendingQuestion
        ? { sessionId: state.pendingQuestion.sessionId, questions: state.pendingQuestion.questions, stale: state.pendingQuestion.stale }
        : null,
      gatePending: state.pendingGate
        ? { sessionId: state.pendingGate.sessionId, gate: state.pendingGate.gate, phaseName: state.pendingGate.phaseName, summary: state.pendingGate.summary, stale: state.pendingGate.stale }
        : null,
      answerHistory: state.answerHistory,
      ...(state.currentFile !== undefined && state.currentFile !== "" && { currentFile: state.currentFile }),
    };
  }
  const firstId = changeStates.size > 0 ? changeStates.keys().next().value ?? null : null;
  const normalizedActiveTabId =
    activeChangeId != null && changeStates.has(activeChangeId)
      ? activeChangeId
      : firstId;
  return {
    type: "state",
    tabs,
    activeTabId: normalizedActiveTabId,
    ...(lastUpdateTime != null && { lastUpdate: lastUpdateTime }),
  };
}

// --- HTTP Server ---

const uiDir = join(packageRoot, "mcp", "ui");
const httpServer = createStaticServer(uiDir, () => projectPath);

// --- WebSocket Server ---

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  wsClients.add(ws);

  if (isPrimaryMode() && projectPath && wsClients.size === 1) {
    const loaded = loadState(projectPath);
    changeStates.clear();
    for (const [id, state] of loaded.changeStates) {
      changeStates.set(id, state);
    }
    activeChangeId = loaded.activeTabId;
  }

  ws.send(JSON.stringify(buildFullDump()));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === "answer" && msg.sessionId) {
        const pending = pendingQuestions.get(msg.sessionId);
        if (pending) {
          clearTimeout(pending.timer);
          pendingQuestions.delete(msg.sessionId);

          for (const [changeId, state] of changeStates) {
            if (state.pendingQuestion?.sessionId === msg.sessionId) {
              state.pendingQuestion = null;
              persistChange(changeId);
              break;
            }
          }

          pending.resolve(msg.answers);
        } else {
          relayToInternalClients(msg);
        }
      }

      if (msg.type === "gate_action" && msg.sessionId) {
        const pending = pendingGates.get(msg.sessionId);
        if (pending) {
          clearTimeout(pending.timer);
          pendingGates.delete(msg.sessionId);

          for (const [changeId, state] of changeStates) {
            if (state.pendingGate?.sessionId === msg.sessionId) {
              state.pendingGate = null;
              persistChange(changeId);
              break;
            }
          }

          const result: { action: string; feedback?: string } = { action: msg.action };
          if (msg.feedback) result.feedback = msg.feedback;
          pending.resolve(result);
        } else {
          relayToInternalClients(msg);
        }
      }

      if (msg.type === "tab_close" && msg.changeId) {
        const changeId = msg.changeId as string;
        changeStates.delete(changeId);
        if (projectPath) deleteChangeState(projectPath, changeId);
        if (activeChangeId === changeId) {
          const ids = Array.from(changeStates.keys());
          activeChangeId = ids[0] ?? null;
          if (projectPath) updateManifestActiveTab(projectPath, activeChangeId);
        }
        broadcast({ type: "tab_closed", changeId });
      }

      if (msg.type === "set_active_tab" && msg.changeId) {
        activeChangeId = msg.changeId as string;
        if (projectPath) updateManifestActiveTab(projectPath, activeChangeId);
      }

      if (msg.type === "request_full_state") {
        if (isPrimaryMode() && projectPath) {
          const loaded = loadState(projectPath);
          changeStates.clear();
          for (const [id, state] of loaded.changeStates) {
            changeStates.set(id, state);
          }
          activeChangeId = loaded.activeTabId;
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(buildFullDump()));
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    wsClients.delete(ws);
  });
});

// --- Helpers ---

function broadcast(message: unknown): boolean {
  const payload = JSON.stringify(message);
  let sent = false;
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      sent = true;
    }
  }
  return sent;
}

function ensureBrowserOpen(): void {
  if (!isPrimaryMode()) return;
  if (serverPort > 0 && !hasBrowserOpened()) {
    openDashboard(`http://localhost:${serverPort}`);
  }
}

async function waitForBroadcast(message: unknown): Promise<void> {
  if (broadcastOrRelay(message)) return;
  ensureBrowserOpen();
  return new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (broadcastOrRelay(message)) {
        clearInterval(check);
        resolve();
      }
    }, 500);
    setTimeout(() => {
      clearInterval(check);
      resolve();
    }, 60_000);
  });
}

function relayToInternalClients(message: unknown): void {
  const payload = JSON.stringify(message);
  for (const ws of internalClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function broadcastPhaseUpdate(
  changeId: string,
  changeState: ChangeState,
  relayPhaseName?: string,
  relayStatus?: string,
): void {
  const uiMessage = {
    type: "phase_update",
    changeId,
    phases: changeState.phases,
    currentPhase: changeState.currentPhase,
    classification:
      changeState.changeContext?.classification ?? changeState.classification,
    changeName: changeState.changeContext?.name ?? changeState.changeName,
    confidence: changeState.changeContext?.confidence ?? changeState.confidence,
  };

  if (isPrimaryMode()) {
    broadcast(uiMessage);
  } else {
    const relayMessage = {
      ...uiMessage,
      ...(relayPhaseName != null && { relayPhaseName, relayStatus }),
    };
    broadcastOrRelay(relayMessage);
  }
}

// --- MCP Server ---

const mcp = new McpServer({
  name: "devflo",
  version: "1.0.0",
});

mcp.tool(
  "devflo_ask_user",
  "Ask the user structured questions with options via the DevFlo dashboard. Blocks until the user submits answers.",
  {
    questions: z
      .array(
        z.object({
          id: z.string().describe("Unique identifier for this question"),
          prompt: z.string().describe("The question text to display"),
          options: z
            .array(
              z.object({
                id: z.string().describe("Unique identifier for this option"),
                label: z.string().describe("Display text for this option"),
                description: z
                  .string()
                  .optional()
                  .describe("Optional description/trade-off text"),
              }),
            )
            .optional()
            .describe("Predefined options for the user to choose from"),
          allowMultiple: z
            .boolean()
            .optional()
            .describe("If true, user can select multiple options"),
        }),
      )
      .describe("Array of questions to present to the user"),
  },
  async ({ questions }) => {
    ensureBrowserOpen();
    const sessionId = randomUUID();
    const changeId = activeChangeId;
    const changeState = changeId ? getActiveState() : null;

    if (changeState && changeId) {
      changeState.pendingQuestion = { sessionId, questions, stale: false };
      persistChange(changeId);
    }

    const answerPromise = new Promise<Record<string, string | string[]>>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          pendingQuestions.delete(sessionId);
          if (changeState) {
            changeState.pendingQuestion = null;
            if (changeId) persistChange(changeId);
          }
          reject(
            new Error(
              "User did not respond within the timeout period (10 minutes)",
            ),
          );
        }, QUESTION_TIMEOUT_MS);
        pendingQuestions.set(sessionId, { resolve, reject, timer });
      },
    );

    const message = { type: "questions", changeId: changeId ?? "", sessionId, questions };
    await waitForBroadcast(message);

    try {
      const answers = await answerPromise;

      if (changeState && changeId) {
        const historyEntries = questions.map((q: { id: string; prompt: string; options?: Array<{ id: string; label: string }> }) => {
          const ans = answers[q.id];
          let answerText: string;
          if (Array.isArray(ans)) {
            answerText = ans.map((a) => q.options?.find((o) => o.id === a)?.label ?? a).join(", ");
          } else if (ans) {
            answerText = q.options?.find((o) => o.id === ans)?.label ?? ans;
          } else {
            answerText = "(no answer)";
          }
          return { questionPrompt: q.prompt, answer: answerText };
        });
        changeState.answerHistory.push(...historyEntries);
        changeState.pendingQuestion = null;
        persistChange(changeId);
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(answers, null, 2) },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
        isError: true,
      };
    }
  },
);

mcp.tool(
  "devflo_update_phase",
  "Update a single SDLC phase on the DevFlo dashboard. The server maintains the full phase list — only send the phase being updated. When a phase becomes active, the previously active phase is auto-completed (unless it has a pending gate). Non-blocking.",
  {
    phaseName: z
      .string()
      .describe(
        "Phase being updated (e.g. Classification, PM, Architect, Developer, QA, Test Summary, Cleanup)",
      ),
    status: z
      .enum(["pending", "active", "completed", "skipped"])
      .describe("New status for this phase"),
    classification: z
      .string()
      .optional()
      .describe("Task classification (e.g. New Feature, Bug Fix)"),
    changeName: z
      .string()
      .optional()
      .describe("OpenSpec change name"),
    confidence: z
      .enum(["HIGH", "MEDIUM", "LOW"])
      .optional()
      .describe("Confidence level for the current phase"),
  },
  async (params) => {
    ensureBrowserOpen();
    const changeId = activeChangeId;
    const changeState = changeId ? getActiveState() : null;
    if (!changeState || !changeId) {
      return { content: [{ type: "text" as const, text: "No active change. Call devflo_set_change_context first." }], isError: true };
    }

    const err = upsertPhase(changeState, params.phaseName, params.status);
    if (err) {
      return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
    }

    if (params.classification) {
      changeState.classification = params.classification;
      if (changeState.changeContext) {
        changeState.changeContext.classification = params.classification;
      }
    }
    if (params.changeName) {
      changeState.changeName = params.changeName;
      if (changeState.changeContext) {
        changeState.changeContext.name = params.changeName;
      }
    }
    if (params.confidence) {
      changeState.confidence = params.confidence;
      if (changeState.changeContext) {
        changeState.changeContext.confidence = params.confidence;
      }
    }

    persistChange(changeId);
    broadcastPhaseUpdate(changeId, changeState, params.phaseName, params.status);
    return {
      content: [{ type: "text" as const, text: "Phase dashboard updated." }],
    };
  },
);

mcp.tool(
  "devflo_set_change_context",
  "Set the active change metadata on the DevFlo dashboard. Call once at the start of a change. Non-blocking.",
  {
    name: z.string().describe("Change name (kebab-case)"),
    classification: z
      .string()
      .describe(
        "Classification: Trivial, Bug Fix, Small Change, New Feature, or Major Refactor",
      ),
    pipeline: z
      .string()
      .describe("Pipeline identifier (e.g. 0→1→2→3→4→5→6)"),
    workspacePath: z
      .string()
      .optional()
      .describe("Path to the OpenSpec change workspace"),
    confidence: z
      .enum(["HIGH", "MEDIUM", "LOW"])
      .optional()
      .describe("Confidence level for the classification"),
  },
  async (params) => {
    ensureBrowserOpen();
    const changeId = params.name;
    const changeState = getOrCreateChange(changeId);

    changeState.changeContext = {
      name: params.name,
      classification: params.classification,
      pipeline: params.pipeline,
      workspacePath: params.workspacePath,
      confidence: params.confidence,
    };
    changeState.classification = params.classification;
    changeState.changeName = params.name;
    if (params.confidence) {
      changeState.confidence = params.confidence;
    }

    if (changeState.phases.length === 0) {
      changeState.phases = initPhasesFromPipeline(params.pipeline);
    }

    activeChangeId = changeId;
    persistChange(changeId);
    if (projectPath) updateManifestActiveTab(projectPath, activeChangeId);

    broadcastOrRelay({
      type: "change_context",
      changeId,
      changeContext: changeState.changeContext,
    });
    broadcastPhaseUpdate(changeId, changeState);

    return {
      content: [
        { type: "text" as const, text: "Change context updated on dashboard." },
      ],
    };
  },
);

mcp.tool(
  "devflo_update_tasks",
  "Update the task board on the DevFlo dashboard. Automatically computes sub-progress on the active phase. Non-blocking.",
  {
    tasks: z
      .array(
        z.object({
          id: z.string().describe("Task identifier (e.g. '1', '2')"),
          title: z.string().describe("Task title"),
          status: z
            .enum(["pending", "in_progress", "completed", "failed", "cancelled"])
            .describe("Current task status"),
          description: z.string().optional().describe("Brief task description"),
        }),
      )
      .describe("Full list of tasks with current status"),
  },
  async ({ tasks }) => {
    const changeId = activeChangeId;
    const changeState = changeId ? getActiveState() : null;
    if (!changeState || !changeId) {
      return { content: [{ type: "text" as const, text: "No active change." }], isError: true };
    }

    changeState.tasks = tasks;
    computeTaskProgress(changeState);

    persistChange(changeId);
    broadcastOrRelay({ type: "tasks_update", changeId, tasks: changeState.tasks });
    broadcastPhaseUpdate(changeId, changeState);

    return {
      content: [
        { type: "text" as const, text: "Task board updated on dashboard." },
      ],
    };
  },
);

mcp.tool(
  "devflo_set_agent_activity",
  "Set optional agent activity for the active change (e.g. current file). Stored in change state and included in dashboard state. Non-blocking.",
  {
    currentFile: z
      .string()
      .optional()
      .describe("Current file path or display string the agent is working on"),
  },
  async (params) => {
    const changeId = activeChangeId;
    const changeState = changeId ? getActiveState() : null;
    if (!changeState || !changeId) {
      return { content: [{ type: "text" as const, text: "No active change. Call devflo_set_change_context first." }], isError: true };
    }

    changeState.currentFile = params.currentFile;
    persistChange(changeId);

    return {
      content: [
        { type: "text" as const, text: "Agent activity updated on dashboard." },
      ],
    };
  },
);

mcp.tool(
  "devflo_log_event",
  "Log a timestamped activity event to the DevFlo dashboard. Non-blocking.",
  {
    phase: z
      .string()
      .describe("Phase name where the event occurred"),
    agent: z
      .string()
      .describe("Agent name (e.g. pm, architect, dev, qa, orchestrator)"),
    message: z.string().describe("Human-readable event description"),
    eventType: z
      .enum(["info", "success", "warning", "error"])
      .describe("Event severity/type"),
  },
  async (params) => {
    const changeId = activeChangeId;
    const changeState = changeId ? getActiveState() : null;

    const event = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      phase: params.phase,
      agent: params.agent,
      message: params.message,
      eventType: params.eventType,
    };

    if (changeState && changeId) {
      changeState.events.push(event);
      persistChange(changeId);
    }

    broadcastOrRelay({ type: "event", changeId: changeId ?? "", event });

    return {
      content: [{ type: "text" as const, text: "Event logged." }],
    };
  },
);

mcp.tool(
  "devflo_await_gate",
  "Request gate approval from the user via the DevFlo dashboard. Blocks until the user approves, revises, or cancels. Returns { action, feedback? }. When action is 'revise' and feedback is present, the user provided revision instructions from the dashboard. When feedback is absent, the user chose to type feedback in the Cursor chat instead.",
  {
    gate: z.enum(["A", "B"]).describe("Gate identifier: A (PM) or B (Architect)"),
    phaseName: z
      .string()
      .describe("Name of the phase requesting approval (e.g. PM, Architect)"),
    summary: z
      .string()
      .optional()
      .describe("Brief summary of what the user should review before approving"),
  },
  async (params) => {
    ensureBrowserOpen();
    const changeId = activeChangeId;
    const changeState = changeId ? getActiveState() : null;

    const gatePhaseMap: Record<string, string> = { A: "PM", B: "Architect" };
    const targetPhaseName = gatePhaseMap[params.gate] ?? params.phaseName;
    const phase = changeState?.phases.find((p) => p.name === targetPhaseName);
    if (phase) phase.gateStatus = "pending";
    if (changeState && changeId) {
      broadcastPhaseUpdate(changeId, changeState);
    }

    const sessionId = randomUUID();

    if (changeState && changeId) {
      changeState.pendingGate = {
        sessionId,
        gate: params.gate,
        phaseName: params.phaseName,
        summary: params.summary,
        stale: false,
      };
      persistChange(changeId);
    }

    const gatePromise = new Promise<{ action: string; feedback?: string }>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingGates.delete(sessionId);
        if (changeState) {
          changeState.pendingGate = null;
          if (changeId) persistChange(changeId);
        }
        reject(
          new Error(
            "User did not respond to gate approval within 30 minutes",
          ),
        );
      }, GATE_TIMEOUT_MS);
      pendingGates.set(sessionId, { resolve, reject, timer });
    });

    const message = {
      type: "gate_request",
      changeId: changeId ?? "",
      sessionId,
      gate: params.gate,
      phaseName: params.phaseName,
      summary: params.summary,
    };
    await waitForBroadcast(message);

    try {
      const result = await gatePromise;

      if (phase) {
        phase.gateStatus =
          result.action === "approve" ? "approved" : "revoked";
      }
      if (changeState && changeId) {
        changeState.pendingGate = null;
        persistChange(changeId);
        broadcastPhaseUpdate(changeId, changeState);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
        isError: true,
      };
    }
  },
);

mcp.tool(
  "devflo_update_qa_results",
  "Update QA review results on the DevFlo dashboard. Non-blocking.",
  {
    verdict: z
      .enum(["pass", "fail", "pending"])
      .describe("Overall QA verdict"),
    findings: z
      .array(
        z.object({
          id: z.string().describe("Finding identifier"),
          severity: z
            .enum(["blocker", "major", "minor", "nit"])
            .describe("Finding severity"),
          description: z.string().describe("Description of the finding"),
          file: z.string().optional().describe("File path"),
          line: z.number().optional().describe("Line number"),
          fixType: z
            .enum(["surgical", "structural"])
            .optional()
            .describe("Fix classification"),
        }),
      )
      .describe("List of QA findings"),
    summary: z
      .string()
      .optional()
      .describe("Brief summary of the QA review"),
  },
  async (params) => {
    const changeId = activeChangeId;
    const changeState = changeId ? getActiveState() : null;
    if (!changeState || !changeId) {
      return { content: [{ type: "text" as const, text: "No active change." }], isError: true };
    }

    changeState.qaResults = {
      verdict: params.verdict,
      findings: params.findings,
      summary: params.summary,
    };

    persistChange(changeId);
    broadcastOrRelay({ type: "qa_update", changeId, qaResults: changeState.qaResults });

    return {
      content: [
        { type: "text" as const, text: "QA results updated on dashboard." },
      ],
    };
  },
);

mcp.tool(
  "devflo_update_test_summary",
  "Update the test summary on the DevFlo dashboard. Non-blocking.",
  {
    commands: z
      .array(z.string())
      .describe("Test commands that were executed"),
    suites: z.number().describe("Number of test suites run"),
    total: z.number().describe("Total number of tests"),
    passed: z.number().describe("Number of tests passed"),
    failed: z.number().describe("Number of tests failed"),
    skipped: z.number().describe("Number of tests skipped"),
    integrationResult: z
      .string()
      .optional()
      .describe("Integration verification result"),
    notes: z.string().optional().describe("Additional notes"),
  },
  async (params) => {
    const changeId = activeChangeId;
    const changeState = changeId ? getActiveState() : null;
    if (!changeState || !changeId) {
      return { content: [{ type: "text" as const, text: "No active change." }], isError: true };
    }

    changeState.testSummary = {
      commands: params.commands,
      suites: params.suites,
      total: params.total,
      passed: params.passed,
      failed: params.failed,
      skipped: params.skipped,
      integrationResult: params.integrationResult,
      notes: params.notes,
    };

    persistChange(changeId);
    broadcastOrRelay({
      type: "test_summary_update",
      changeId,
      testSummary: changeState.testSummary,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: "Test summary updated on dashboard.",
        },
      ],
    };
  },
);

// --- Internal WebSocket path for secondary MCP processes ---

const INTERNAL_WS_PATH = "/internal";

wss.on("headers", (headers, req) => {
  if (req.url === INTERNAL_WS_PATH) {
    headers.push("X-DevFlo-Internal: true");
  }
});

/**
 * Secondary bridge: when this process detects a primary server already running,
 * it connects to the primary via an internal WebSocket and relays all
 * broadcast/question/gate traffic through it instead of running its own
 * HTTP server.
 */
let primaryWs: WebSocket | null = null;

function isPrimaryMode(): boolean {
  return primaryWs === null;
}

function broadcastOrRelay(message: unknown): boolean {
  if (isPrimaryMode()) {
    return broadcast(message);
  }
  if (primaryWs && primaryWs.readyState === WebSocket.OPEN) {
    primaryWs.send(JSON.stringify({ type: "relay", payload: message }));
    return true;
  }
  return false;
}

// Apply relayed payload to primary's state so full dump stays in sync (Fix: session survives browser close)
function applyRelayPayload(payload: unknown): void {
  if (!payload || typeof payload !== "object" || !("type" in payload)) return;
  const p = payload as { type: string; changeId?: string; [k: string]: unknown };

  switch (p.type) {
    case "change_context": {
      const changeId = p.changeId as string | undefined;
      const changeContext = p.changeContext;
      if (!changeId || !changeContext) break;
      const state = getOrCreateChange(changeId);
      state.changeContext = changeContext as ChangeState["changeContext"];
      state.classification = (changeContext as { classification?: string }).classification ?? "";
      state.changeName = (changeContext as { name?: string }).name ?? "";
      state.confidence = (changeContext as { confidence?: string }).confidence ?? "";
      activeChangeId = changeId;
      persistChange(changeId);
      if (projectPath) updateManifestActiveTab(projectPath, changeId);
      break;
    }
    case "phase_update": {
      const changeId = p.changeId as string | undefined;
      if (!changeId) break;
      const state = getOrCreateChange(changeId);

      const relayPhaseName = p.relayPhaseName as string | undefined;
      const relayStatus = p.relayStatus as string | undefined;
      if (relayPhaseName && relayStatus) {
        upsertPhase(state, relayPhaseName, relayStatus);
      } else {
        state.phases = (p.phases as ChangeState["phases"]) ?? [];
        state.currentPhase = (p.currentPhase as string) ?? "";
      }

      if (p.classification != null) state.classification = p.classification as string;
      if (p.changeName != null) state.changeName = p.changeName as string;
      if (p.confidence != null) state.confidence = p.confidence as string;
      if (state.changeContext) {
        if (p.classification != null) state.changeContext.classification = p.classification as string;
        if (p.changeName != null) state.changeContext.name = p.changeName as string;
        if (p.confidence != null) state.changeContext.confidence = p.confidence as string;
      }
      persistChange(changeId);
      break;
    }
    case "tasks_update": {
      const changeId = p.changeId as string | undefined;
      if (!changeId) break;
      const state = getOrCreateChange(changeId);
      state.tasks = (p.tasks as ChangeState["tasks"]) ?? [];
      computeTaskProgress(state);
      persistChange(changeId);
      break;
    }
    case "event": {
      const changeId = (p.changeId as string) ?? "";
      const event = p.event;
      if (!changeId || !event || typeof event !== "object") break;
      const state = getOrCreateChange(changeId);
      state.events.push(event as ChangeState["events"][number]);
      persistChange(changeId);
      break;
    }
    case "qa_update": {
      const changeId = p.changeId as string | undefined;
      if (!changeId) break;
      const state = getOrCreateChange(changeId);
      state.qaResults = (p.qaResults as ChangeState["qaResults"]) ?? null;
      persistChange(changeId);
      break;
    }
    case "test_summary_update": {
      const changeId = p.changeId as string | undefined;
      if (!changeId) break;
      const state = getOrCreateChange(changeId);
      state.testSummary = (p.testSummary as ChangeState["testSummary"]) ?? null;
      persistChange(changeId);
      break;
    }
    case "questions": {
      const changeId = (p.changeId as string) ?? "";
      const sessionId = p.sessionId as string | undefined;
      const questions = p.questions;
      if (!changeId || !sessionId || !Array.isArray(questions)) break;
      const state = getOrCreateChange(changeId);
      state.pendingQuestion = { sessionId, questions, stale: false };
      persistChange(changeId);
      break;
    }
    case "gate_request": {
      const changeId = (p.changeId as string) ?? "";
      const sessionId = p.sessionId as string | undefined;
      const gate = p.gate as string | undefined;
      const phaseName = p.phaseName as string | undefined;
      const summary = p.summary as string | undefined;
      if (!changeId || !sessionId || !gate || !phaseName) break;
      const state = getOrCreateChange(changeId);
      const phase = state.phases.find((ph) => ph.name === phaseName);
      if (phase) phase.gateStatus = "pending";
      state.pendingGate = { sessionId, gate, phaseName, summary: summary ?? "", stale: false };
      persistChange(changeId);
      break;
    }
    case "tab_closed": {
      const changeId = p.changeId as string | undefined;
      if (!changeId) break;
      changeStates.delete(changeId);
      if (projectPath) deleteChangeState(projectPath, changeId);
      if (activeChangeId === changeId) {
        const ids = Array.from(changeStates.keys());
        activeChangeId = ids[0] ?? null;
        if (projectPath) updateManifestActiveTab(projectPath, activeChangeId);
      }
      break;
    }
    default:
      break;
  }
}

// Handle internal WebSocket connections from secondary MCP processes
const internalClients = new Set<WebSocket>();

function handleInternalConnection(ws: WebSocket): void {
  internalClients.add(ws);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "relay" && msg.payload) {
        if (isPrimaryMode()) applyRelayPayload(msg.payload);
        broadcast(msg.payload);
      }
    } catch {
      // ignore
    }
  });

  ws.on("close", () => {
    internalClients.delete(ws);
  });
}

// Patch the wss connection handler to distinguish browser vs internal clients
const originalWssEmit = wss.emit.bind(wss);
wss.emit = function (event: string, ...args: unknown[]): boolean {
  if (event === "connection") {
    const ws = args[0] as WebSocket;
    const req = args[1] as { url?: string };
    if (req?.url === INTERNAL_WS_PATH) {
      handleInternalConnection(ws);
      return true;
    }
  }
  return originalWssEmit(event, ...args);
} as typeof wss.emit;

// --- Start ---

async function startAsPrimary(): Promise<void> {
  const loaded = loadState(projectPath);
  for (const [id, state] of loaded.changeStates) {
    changeStates.set(id, state);
  }
  activeChangeId = loaded.activeTabId;

  const port = await acquirePort(projectPath);

  httpServer.listen(port, "127.0.0.1", () => {
    const addr = httpServer.address();
    if (addr && typeof addr === "object") {
      serverPort = addr.port;
      writePortFile(projectPath, serverPort);
    }
  });
}

async function startAsSecondary(primaryPort: number): Promise<void> {
  serverPort = primaryPort;

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${primaryPort}${INTERNAL_WS_PATH}`);

    ws.on("open", () => {
      primaryWs = ws;
      resolve();
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "answer" && msg.sessionId) {
          const pending = pendingQuestions.get(msg.sessionId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingQuestions.delete(msg.sessionId);
            pending.resolve(msg.answers);
          }
        }
        if (msg.type === "gate_action" && msg.sessionId) {
          const pending = pendingGates.get(msg.sessionId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingGates.delete(msg.sessionId);
            const result: { action: string; feedback?: string } = { action: msg.action };
            if (msg.feedback) result.feedback = msg.feedback;
            pending.resolve(result);
          }
        }
      } catch {
        // ignore
      }
    });

    ws.on("close", () => {
      primaryWs = null;
    });

    ws.on("error", () => {
      reject(new Error("Failed to connect to primary DevFlo server"));
    });
  });
}

export async function startMcpServer(): Promise<void> {
  projectPath = process.cwd();

  const existingPort = readPortFile(projectPath);
  if (existingPort && await isDevfloServerAlive(existingPort)) {
    try {
      await startAsSecondary(existingPort);
    } catch {
      await startAsPrimary();
    }
  } else {
    await startAsPrimary();
  }

  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}
