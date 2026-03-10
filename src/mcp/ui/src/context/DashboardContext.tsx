import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import type {
  ServerMessage,
  ConnectionStatus,
  AnswerHistoryEntry,
  TabState,
  AppState,
  ServerTabState,
} from "../types";

function createEmptyTab(): TabState {
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
    questionBatch: null,
    gatePending: null,
    answerHistory: [],
    currentFile: undefined,
    selectedPhaseFilter: null,
    currentQuestionIndex: 0,
    answers: {},
  };
}

const initialState: AppState = {
  tabs: {},
  activeTabId: null,
  connectionStatus: "connecting",
  lastUpdate: null,
  projectPath: null,
};

type Action =
  | { type: "SET_FULL_STATE"; tabs: Record<string, ServerTabState>; activeTabId: string | null; lastUpdate?: string }
  | { type: "SET_ACTIVE_TAB"; tabId: string }
  | { type: "REMOVE_TAB"; changeId: string }
  | {
      type: "SET_PHASES";
      changeId: string;
      phases: TabState["phases"];
      currentPhase: string;
      classification: string;
      changeName: string;
      confidence: string;
    }
  | { type: "SET_CHANGE_CONTEXT"; changeId: string; changeContext: NonNullable<TabState["changeContext"]> }
  | { type: "SET_PHASE_FILTER"; phaseFilter: string | null }
  | { type: "SET_TASKS"; changeId: string; tasks: TabState["tasks"] }
  | { type: "ADD_EVENT"; changeId: string; event: TabState["events"][number] }
  | { type: "SET_QA_RESULTS"; changeId: string; qaResults: NonNullable<TabState["qaResults"]> }
  | { type: "SET_TEST_SUMMARY"; changeId: string; testSummary: NonNullable<TabState["testSummary"]> }
  | { type: "SET_GATE_PENDING"; changeId: string; gate: NonNullable<TabState["gatePending"]> }
  | { type: "CLEAR_GATE_PENDING"; changeId: string }
  | { type: "SET_QUESTIONS"; changeId: string; sessionId: string; questions: NonNullable<TabState["questionBatch"]>["questions"]; stale?: boolean }
  | { type: "SET_ANSWER"; questionId: string; value: string | string[] }
  | { type: "NEXT_QUESTION" }
  | { type: "PREV_QUESTION" }
  | { type: "SUBMIT_COMPLETE"; historyEntries: AnswerHistoryEntry[] }
  | { type: "SET_CONNECTION"; status: ConnectionStatus }
  | { type: "SET_LAST_UPDATE"; lastUpdate: string | null }
  | { type: "SET_PROJECT_PATH"; projectPath: string | null };

function getTab(state: AppState, changeId: string): TabState {
  return state.tabs[changeId] ?? createEmptyTab();
}

function updateTab(state: AppState, changeId: string, patch: Partial<TabState>): AppState {
  const existing = state.tabs[changeId] ?? createEmptyTab();
  return {
    ...state,
    tabs: {
      ...state.tabs,
      [changeId]: { ...existing, ...patch },
    },
  };
}

function serverTabToClientTab(st: ServerTabState): TabState {
  return {
    changeContext: st.changeContext,
    phases: st.phases,
    currentPhase: st.currentPhase,
    classification: st.classification ?? st.changeContext?.classification ?? "",
    changeName: st.changeName ?? st.changeContext?.name ?? "",
    confidence: st.confidence ?? st.changeContext?.confidence ?? "",
    tasks: st.tasks,
    events: st.events,
    qaResults: st.qaResults,
    testSummary: st.testSummary,
    questionBatch: st.questionBatch,
    gatePending: st.gatePending,
    answerHistory: st.answerHistory ?? [],
    currentFile: st.currentFile,
    selectedPhaseFilter: null,
    currentQuestionIndex: 0,
    answers: {},
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_FULL_STATE": {
      const tabs: Record<string, TabState> = {};
      for (const [id, serverTab] of Object.entries(action.tabs)) {
        const existing = state.tabs[id];
        const converted = serverTabToClientTab(serverTab);
        tabs[id] = existing
          ? { ...converted, selectedPhaseFilter: existing.selectedPhaseFilter, currentQuestionIndex: existing.currentQuestionIndex, answers: existing.answers }
          : converted;
      }
      const tabIds = Object.keys(tabs);
      const normalizedActiveTabId =
        action.activeTabId != null && tabIds.includes(action.activeTabId)
          ? action.activeTabId
          : tabIds[0] ?? null;
      return {
        ...state,
        tabs,
        activeTabId: normalizedActiveTabId,
        lastUpdate: action.lastUpdate ?? state.lastUpdate,
      };
    }

    case "SET_ACTIVE_TAB":
      return { ...state, activeTabId: action.tabId };

    case "REMOVE_TAB": {
      const { [action.changeId]: _, ...rest } = state.tabs;
      const newActiveId = state.activeTabId === action.changeId
        ? (Object.keys(rest)[0] ?? null)
        : state.activeTabId;
      return { ...state, tabs: rest, activeTabId: newActiveId };
    }

    case "SET_PHASES":
      return updateTab(state, action.changeId, {
        phases: action.phases,
        currentPhase: action.currentPhase,
        classification: action.classification,
        changeName: action.changeName,
        confidence: action.confidence,
      });

    case "SET_CHANGE_CONTEXT": {
      const tab = getTab(state, action.changeId);
      const updated = updateTab(state, action.changeId, {
        changeContext: action.changeContext,
        classification: action.changeContext.classification,
        changeName: action.changeContext.name,
        confidence: action.changeContext.confidence ?? tab.confidence,
      });
      if (!state.activeTabId || !state.tabs[state.activeTabId]) {
        return { ...updated, activeTabId: action.changeId };
      }
      return updated;
    }

    case "SET_PHASE_FILTER": {
      if (!state.activeTabId) return state;
      return updateTab(state, state.activeTabId, {
        selectedPhaseFilter: action.phaseFilter,
      });
    }

    case "SET_TASKS":
      return updateTab(state, action.changeId, { tasks: action.tasks });

    case "ADD_EVENT": {
      const tab = getTab(state, action.changeId);
      return updateTab(state, action.changeId, {
        events: [...tab.events, action.event],
      });
    }

    case "SET_QA_RESULTS":
      return updateTab(state, action.changeId, { qaResults: action.qaResults });

    case "SET_TEST_SUMMARY":
      return updateTab(state, action.changeId, { testSummary: action.testSummary });

    case "SET_GATE_PENDING":
      return updateTab(state, action.changeId, { gatePending: action.gate });

    case "CLEAR_GATE_PENDING":
      return updateTab(state, action.changeId, { gatePending: null });

    case "SET_QUESTIONS":
      return updateTab(state, action.changeId, {
        questionBatch: {
          sessionId: action.sessionId,
          questions: action.questions,
          stale: action.stale,
        },
        currentQuestionIndex: 0,
        answers: {},
      });

    case "SET_ANSWER": {
      if (!state.activeTabId) return state;
      const tab = getTab(state, state.activeTabId);
      return updateTab(state, state.activeTabId, {
        answers: { ...tab.answers, [action.questionId]: action.value },
      });
    }

    case "NEXT_QUESTION": {
      if (!state.activeTabId) return state;
      const tab = getTab(state, state.activeTabId);
      return updateTab(state, state.activeTabId, {
        currentQuestionIndex: Math.min(
          tab.currentQuestionIndex + 1,
          (tab.questionBatch?.questions.length ?? 1) - 1,
        ),
      });
    }

    case "PREV_QUESTION": {
      if (!state.activeTabId) return state;
      const tab = getTab(state, state.activeTabId);
      return updateTab(state, state.activeTabId, {
        currentQuestionIndex: Math.max(tab.currentQuestionIndex - 1, 0),
      });
    }

    case "SUBMIT_COMPLETE": {
      if (!state.activeTabId) return state;
      const tab = getTab(state, state.activeTabId);
      return updateTab(state, state.activeTabId, {
        questionBatch: null,
        currentQuestionIndex: 0,
        answers: {},
        answerHistory: [...tab.answerHistory, ...action.historyEntries],
      });
    }

    case "SET_CONNECTION":
      return { ...state, connectionStatus: action.status };

    case "SET_LAST_UPDATE":
      return { ...state, lastUpdate: action.lastUpdate };

    case "SET_PROJECT_PATH":
      return { ...state, projectPath: action.projectPath };

    default:
      return state;
  }
}

export interface ActiveTabView {
  changeContext: TabState["changeContext"];
  phases: TabState["phases"];
  currentPhase: string;
  classification: string;
  changeName: string;
  confidence: string;
  tasks: TabState["tasks"];
  events: TabState["events"];
  qaResults: TabState["qaResults"];
  testSummary: TabState["testSummary"];
  questionBatch: TabState["questionBatch"];
  gatePending: TabState["gatePending"];
  history: AnswerHistoryEntry[];
  /** Optional current file path (or display string) for agent activity. */
  currentFile?: string;
  selectedPhaseFilter: string | null;
  currentQuestionIndex: number;
  answers: Record<string, string | string[]>;
  connectionStatus: ConnectionStatus;
}

interface DashboardContextValue {
  state: ActiveTabView;
  appState: AppState;
  setAnswer: (questionId: string, value: string | string[]) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  submitAnswers: () => void;
  submitGateAction: (action: "approve" | "revise" | "cancel", feedback?: string) => void;
  setPhaseFilter: (phaseFilter: string | null) => void;
  setActiveTab: (changeId: string) => void;
  closeTab: (changeId: string) => void;
  requestFullState: () => void;
}

const emptyTabView: ActiveTabView = {
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
  questionBatch: null,
  gatePending: null,
  history: [],
  currentFile: undefined,
  selectedPhaseFilter: null,
  currentQuestionIndex: 0,
  answers: {},
  connectionStatus: "connecting",
};

function deriveActiveTabView(appState: AppState): ActiveTabView {
  const tab = appState.activeTabId ? appState.tabs[appState.activeTabId] : null;
  if (!tab) return { ...emptyTabView, connectionStatus: appState.connectionStatus };
  return {
    changeContext: tab.changeContext,
    phases: tab.phases,
    currentPhase: tab.currentPhase,
    classification: tab.classification,
    changeName: tab.changeName,
    confidence: tab.confidence,
    tasks: tab.tasks,
    events: tab.events,
    qaResults: tab.qaResults,
    testSummary: tab.testSummary,
    questionBatch: tab.questionBatch,
    gatePending: tab.gatePending,
    history: tab.answerHistory,
    currentFile: tab.currentFile,
    selectedPhaseFilter: tab.selectedPhaseFilter,
    currentQuestionIndex: tab.currentQuestionIndex,
    answers: tab.answers,
    connectionStatus: appState.connectionStatus,
  };
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [appState, dispatch] = useReducer(reducer, initialState);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "state":
        dispatch({
          type: "SET_FULL_STATE",
          tabs: msg.tabs,
          activeTabId: msg.activeTabId,
          lastUpdate: msg.lastUpdate,
        });
        break;
      case "phase_update":
        dispatch({
          type: "SET_PHASES",
          changeId: msg.changeId,
          phases: msg.phases,
          currentPhase: msg.currentPhase,
          classification: msg.classification ?? "",
          changeName: msg.changeName ?? "",
          confidence: msg.confidence ?? "",
        });
        dispatch({ type: "SET_LAST_UPDATE", lastUpdate: new Date().toISOString() });
        break;
      case "questions":
        dispatch({
          type: "SET_QUESTIONS",
          changeId: msg.changeId,
          sessionId: msg.sessionId,
          questions: msg.questions,
          stale: msg.stale,
        });
        dispatch({ type: "SET_LAST_UPDATE", lastUpdate: new Date().toISOString() });
        break;
      case "change_context":
        dispatch({
          type: "SET_CHANGE_CONTEXT",
          changeId: msg.changeId,
          changeContext: msg.changeContext,
        });
        dispatch({ type: "SET_LAST_UPDATE", lastUpdate: new Date().toISOString() });
        break;
      case "tasks_update":
        dispatch({ type: "SET_TASKS", changeId: msg.changeId, tasks: msg.tasks });
        dispatch({ type: "SET_LAST_UPDATE", lastUpdate: new Date().toISOString() });
        break;
      case "event":
        dispatch({ type: "ADD_EVENT", changeId: msg.changeId, event: msg.event });
        dispatch({ type: "SET_LAST_UPDATE", lastUpdate: new Date().toISOString() });
        break;
      case "qa_update":
        dispatch({ type: "SET_QA_RESULTS", changeId: msg.changeId, qaResults: msg.qaResults });
        dispatch({ type: "SET_LAST_UPDATE", lastUpdate: new Date().toISOString() });
        break;
      case "test_summary_update":
        dispatch({
          type: "SET_TEST_SUMMARY",
          changeId: msg.changeId,
          testSummary: msg.testSummary,
        });
        dispatch({ type: "SET_LAST_UPDATE", lastUpdate: new Date().toISOString() });
        break;
      case "gate_request":
        dispatch({
          type: "SET_GATE_PENDING",
          changeId: msg.changeId,
          gate: {
            sessionId: msg.sessionId,
            gate: msg.gate,
            phaseName: msg.phaseName,
            summary: msg.summary,
            stale: msg.stale,
          },
        });
        dispatch({ type: "SET_LAST_UPDATE", lastUpdate: new Date().toISOString() });
        break;
      case "tab_closed":
        dispatch({ type: "REMOVE_TAB", changeId: msg.changeId });
        dispatch({ type: "SET_LAST_UPDATE", lastUpdate: new Date().toISOString() });
        break;
    }
  }, []);

  const { status, send } = useWebSocket(handleMessage);

  useEffect(() => {
    if (appState.connectionStatus !== status) {
      dispatch({ type: "SET_CONNECTION", status });
    }
  }, [status, appState.connectionStatus]);

  useEffect(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    if (!base) return;
    fetch(`${base}/api/project`)
      .then((r) => r.json())
      .then((d: { projectPath?: string | null }) =>
        dispatch({ type: "SET_PROJECT_PATH", projectPath: d.projectPath ?? null })
      )
      .catch(() => dispatch({ type: "SET_PROJECT_PATH", projectPath: null }));
  }, []);

  const activeTab = appState.activeTabId ? appState.tabs[appState.activeTabId] : null;

  useEffect(() => {
    const needsAttention = !!(activeTab?.questionBatch && !activeTab.questionBatch.stale)
      || !!(activeTab?.gatePending && !activeTab.gatePending.stale);

    const anyTabNeedsAttention = Object.values(appState.tabs).some(
      (t) => (t.questionBatch && !t.questionBatch.stale) || (t.gatePending && !t.gatePending.stale),
    );

    if (anyTabNeedsAttention) {
      document.title = "(\u2022) DevFlo Dashboard";
      if (needsAttention && Notification.permission === "granted") {
        new Notification("DevFlo needs your input", {
          body: activeTab?.gatePending
            ? `Gate ${activeTab.gatePending.gate} approval required`
            : "A question is waiting for your answer",
        });
      } else if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    } else {
      document.title = "DevFlo Dashboard";
    }
  }, [activeTab?.questionBatch, activeTab?.gatePending, appState.tabs]);

  const setAnswer = useCallback(
    (questionId: string, value: string | string[]) => {
      dispatch({ type: "SET_ANSWER", questionId, value });
    },
    [],
  );

  const nextQuestion = useCallback(() => dispatch({ type: "NEXT_QUESTION" }), []);
  const prevQuestion = useCallback(() => dispatch({ type: "PREV_QUESTION" }), []);

  const submitAnswers = useCallback(() => {
    if (!appState.activeTabId) return;
    const tab = appState.tabs[appState.activeTabId];
    if (!tab?.questionBatch) return;

    send({
      type: "answer",
      sessionId: tab.questionBatch.sessionId,
      answers: tab.answers,
    });

    const historyEntries: AnswerHistoryEntry[] =
      tab.questionBatch.questions.map((q) => {
        const ans = tab.answers[q.id];
        let answerText: string;
        if (Array.isArray(ans)) {
          const labels = ans.map(
            (a) => q.options?.find((o) => o.id === a)?.label ?? a,
          );
          answerText = labels.join(", ");
        } else if (ans) {
          answerText = q.options?.find((o) => o.id === ans)?.label ?? ans;
        } else {
          answerText = "(no answer)";
        }
        return { questionPrompt: q.prompt, answer: answerText };
      });

    dispatch({ type: "SUBMIT_COMPLETE", historyEntries });
  }, [appState.activeTabId, appState.tabs, send]);

  const submitGateAction = useCallback(
    (action: "approve" | "revise" | "cancel", feedback?: string) => {
      if (!appState.activeTabId) return;
      const tab = appState.tabs[appState.activeTabId];
      if (!tab?.gatePending) return;
      const payload: Record<string, unknown> = {
        type: "gate_action",
        sessionId: tab.gatePending.sessionId,
        action,
      };
      if (action === "revise" && feedback) {
        payload.feedback = feedback;
      }
      send(payload);
      dispatch({ type: "CLEAR_GATE_PENDING", changeId: appState.activeTabId });
    },
    [appState.activeTabId, appState.tabs, send],
  );

  const setPhaseFilter = useCallback((phaseFilter: string | null) => {
    dispatch({ type: "SET_PHASE_FILTER", phaseFilter });
  }, []);

  const setActiveTab = useCallback(
    (changeId: string) => {
      dispatch({ type: "SET_ACTIVE_TAB", tabId: changeId });
      send({ type: "set_active_tab", changeId });
    },
    [send],
  );

  const closeTab = useCallback(
    (changeId: string) => {
      send({ type: "tab_close", changeId });
      dispatch({ type: "REMOVE_TAB", changeId });
    },
    [send],
  );

  const requestFullState = useCallback(() => {
    send({ type: "request_full_state" });
  }, [send]);

  const state = deriveActiveTabView(appState);

  return (
    <DashboardContext.Provider
      value={{
        state,
        appState,
        setAnswer,
        nextQuestion,
        prevQuestion,
        submitAnswers,
        submitGateAction,
        setPhaseFilter,
        setActiveTab,
        closeTab,
        requestFullState,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx)
    throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
