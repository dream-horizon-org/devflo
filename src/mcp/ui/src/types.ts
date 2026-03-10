export interface Phase {
  name: string;
  status: "pending" | "active" | "completed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  gateStatus?: "pending" | "approved" | "revoked";
  subProgress?: { current: number; total: number; label: string };
}

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

export interface Question {
  id: string;
  prompt: string;
  options?: QuestionOption[];
  allowMultiple?: boolean;
}

export interface QuestionBatch {
  sessionId: string;
  questions: Question[];
}

export interface AnswerHistoryEntry {
  questionPrompt: string;
  answer: string;
}

export interface TaskItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  description?: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  phase: string;
  agent: string;
  message: string;
  eventType: "info" | "success" | "warning" | "error";
}

export interface QAFinding {
  id: string;
  severity: "blocker" | "major" | "minor" | "nit";
  description: string;
  file?: string;
  line?: number;
  fixType?: "surgical" | "structural";
}

export interface QAResults {
  verdict: "pass" | "fail" | "pending";
  findings: QAFinding[];
  summary?: string;
}

export interface TestSummary {
  commands: string[];
  suites: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  integrationResult?: string;
  notes?: string;
}

export interface ChangeContext {
  name: string;
  classification: string;
  pipeline: string;
  workspacePath?: string;
  confidence?: string;
}

export interface GatePending {
  sessionId: string;
  gate: string;
  phaseName: string;
  summary?: string;
  stale?: boolean;
}

export interface StaleQuestionBatch extends QuestionBatch {
  stale?: boolean;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface TabState {
  changeContext: ChangeContext | null;
  phases: Phase[];
  currentPhase: string;
  classification: string;
  changeName: string;
  confidence: string;
  tasks: TaskItem[];
  events: ActivityEvent[];
  qaResults: QAResults | null;
  testSummary: TestSummary | null;
  questionBatch: StaleQuestionBatch | null;
  gatePending: GatePending | null;
  answerHistory: AnswerHistoryEntry[];
  /** Optional current file path (or display string) for agent activity. */
  currentFile?: string;
  selectedPhaseFilter: string | null;
  currentQuestionIndex: number;
  answers: Record<string, string | string[]>;
}

export interface AppState {
  tabs: Record<string, TabState>;
  activeTabId: string | null;
  connectionStatus: ConnectionStatus;
  lastUpdate: string | null;
  /** Project root path (from server) for "Open in Cursor". */
  projectPath: string | null;
}

/** @deprecated kept for migration reference only */
export interface DashboardState {
  changeContext: ChangeContext | null;
  phases: Phase[];
  currentPhase: string;
  classification: string;
  changeName: string;
  confidence: string;
  selectedPhaseFilter: string | null;
  questionBatch: QuestionBatch | null;
  currentQuestionIndex: number;
  answers: Record<string, string | string[]>;
  history: AnswerHistoryEntry[];
  tasks: TaskItem[];
  events: ActivityEvent[];
  qaResults: QAResults | null;
  testSummary: TestSummary | null;
  gatePending: GatePending | null;
  connectionStatus: ConnectionStatus;
}

export type ServerMessage =
  | {
      type: "state";
      tabs: Record<string, ServerTabState>;
      activeTabId: string | null;
      lastUpdate?: string;
    }
  | {
      type: "phase_update";
      changeId: string;
      phases: Phase[];
      currentPhase: string;
      classification?: string;
      changeName?: string;
      confidence?: string;
    }
  | { type: "questions"; changeId: string; sessionId: string; questions: Question[]; stale?: boolean }
  | { type: "change_context"; changeId: string; changeContext: ChangeContext }
  | { type: "tasks_update"; changeId: string; tasks: TaskItem[] }
  | { type: "event"; changeId: string; event: ActivityEvent }
  | { type: "qa_update"; changeId: string; qaResults: QAResults }
  | { type: "test_summary_update"; changeId: string; testSummary: TestSummary }
  | {
      type: "gate_request";
      changeId: string;
      sessionId: string;
      gate: string;
      phaseName: string;
      summary?: string;
      stale?: boolean;
    }
  | { type: "tab_closed"; changeId: string };

export interface ServerTabState {
  changeContext: ChangeContext | null;
  phases: Phase[];
  currentPhase: string;
  classification: string;
  changeName: string;
  confidence: string;
  tasks: TaskItem[];
  events: ActivityEvent[];
  qaResults: QAResults | null;
  testSummary: TestSummary | null;
  questionBatch: (StaleQuestionBatch & { stale?: boolean }) | null;
  gatePending: (GatePending & { stale?: boolean }) | null;
  answerHistory: AnswerHistoryEntry[];
  /** Optional current file path (or display string) for agent activity. */
  currentFile?: string;
}

export interface ClientMessage {
  type: "answer" | "gate_action" | "tab_close" | "set_active_tab" | "request_full_state";
  sessionId?: string;
  changeId?: string;
  answers?: Record<string, string | string[]>;
  action?: string;
  feedback?: string;
}
