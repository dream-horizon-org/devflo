import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import * as DashboardContext from "./context/DashboardContext";
import { App } from "./App";
import type { ActiveTabView, AppState } from "./types";

vi.mock("./context/DashboardContext", () => ({
  DashboardProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useDashboard: vi.fn(),
}));

const mockUseDashboard = vi.mocked(DashboardContext.useDashboard);

function createMockState(overrides: Partial<ActiveTabView> = {}): ActiveTabView {
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
    history: [],
    selectedPhaseFilter: null,
    currentQuestionIndex: 0,
    answers: {},
    connectionStatus: "connected",
    ...overrides,
  };
}

function createMockAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    tabs: {},
    activeTabId: null,
    connectionStatus: "connected",
    lastUpdate: null,
    ...overrides,
  };
}

describe("App layout — Specs panel and single spec surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Specs panel when active tab has changeContext.workspacePath", () => {
    const tabId = "change-1";
    mockUseDashboard.mockReturnValue({
      state: createMockState({
        changeContext: {
          name: "test-change",
          classification: "Feature",
          pipeline: "full",
          workspacePath: "/openspec/changes/test",
        },
      }),
      appState: createMockAppState({
        tabs: {
          [tabId]: {
            changeContext: {
              name: "test-change",
              classification: "Feature",
              pipeline: "full",
              workspacePath: "/openspec/changes/test",
            },
            phases: [],
            currentPhase: "",
            classification: "Feature",
            changeName: "test-change",
            confidence: "",
            tasks: [],
            events: [],
            qaResults: null,
            testSummary: null,
            questionBatch: null,
            gatePending: null,
            answerHistory: [],
            selectedPhaseFilter: null,
            currentQuestionIndex: 0,
            answers: {},
          },
        },
        activeTabId: tabId,
      }),
      setAnswer: vi.fn(),
      nextQuestion: vi.fn(),
      prevQuestion: vi.fn(),
      submitAnswers: vi.fn(),
      submitGateAction: vi.fn(),
      setPhaseFilter: vi.fn(),
      setActiveTab: vi.fn(),
      closeTab: vi.fn(),
      requestFullState: vi.fn(),
    });

    render(<App />);

    expect(screen.getByTestId("specs-panel")).toBeInTheDocument();
  });

  it("does not render Specs panel when workspacePath is unset", () => {
    mockUseDashboard.mockReturnValue({
      state: createMockState({ changeContext: null }),
      appState: createMockAppState({ activeTabId: null, tabs: {} }),
      setAnswer: vi.fn(),
      nextQuestion: vi.fn(),
      prevQuestion: vi.fn(),
      submitAnswers: vi.fn(),
      submitGateAction: vi.fn(),
      setPhaseFilter: vi.fn(),
      setActiveTab: vi.fn(),
      closeTab: vi.fn(),
      requestFullState: vi.fn(),
    });

    render(<App />);

    expect(screen.queryByTestId("specs-panel")).not.toBeInTheDocument();
  });

  it("does not render FileViewer (Workspace Files) in main content — single canonical Specs area", () => {
    mockUseDashboard.mockReturnValue({
      state: createMockState({
        changeContext: {
          name: "x",
          classification: "Feature",
          pipeline: "full",
          workspacePath: "/foo",
        },
      }),
      appState: createMockAppState({
        tabs: {
          "1": {
            changeContext: {
              name: "x",
              classification: "Feature",
              pipeline: "full",
              workspacePath: "/foo",
            },
            phases: [],
            currentPhase: "",
            classification: "Feature",
            changeName: "x",
            confidence: "",
            tasks: [],
            events: [],
            qaResults: null,
            testSummary: null,
            questionBatch: null,
            gatePending: null,
            answerHistory: [],
            selectedPhaseFilter: null,
            currentQuestionIndex: 0,
            answers: {},
          },
        },
        activeTabId: "1",
      }),
      setAnswer: vi.fn(),
      nextQuestion: vi.fn(),
      prevQuestion: vi.fn(),
      submitAnswers: vi.fn(),
      submitGateAction: vi.fn(),
      setPhaseFilter: vi.fn(),
      setActiveTab: vi.fn(),
      closeTab: vi.fn(),
      requestFullState: vi.fn(),
    });

    render(<App />);

    const main = screen.getByTestId("main-content");
    expect(main).toBeInTheDocument();
    expect(main.textContent).not.toMatch(/Workspace Files/);
  });
});
