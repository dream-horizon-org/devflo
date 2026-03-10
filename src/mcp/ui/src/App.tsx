import { DashboardProvider, useDashboard } from "./context/DashboardContext";
import { PhaseTimeline } from "./components/PhaseTimeline";
import { ChangeHeader } from "./components/ChangeHeader";
import { QuestionCard } from "./components/QuestionCard";
import { GateApprovalCard } from "./components/GateApprovalCard";
import { TaskBoard } from "./components/TaskBoard";
import { QAResultsPanel } from "./components/QAResultsPanel";
import { TestSummaryPanel } from "./components/TestSummaryPanel";
import { AnswerHistory } from "./components/AnswerHistory";
import { ActivityLog } from "./components/ActivityLog";
import { ReconnectBanner } from "./components/ReconnectBanner";
import { TabBar } from "./components/TabBar";
import { ResizableSpecPanel } from "./components/ResizableSpecPanel";
import { SpecsArea } from "./components/SpecsArea";

function DashboardContent() {
  const { state, appState } = useDashboard();

  const hasTabs = Object.keys(appState.tabs).length > 0;
  const hasActiveTab = !!appState.activeTabId && !!appState.tabs[appState.activeTabId];
  const hasBlockingContent = !!state.questionBatch || !!state.gatePending;
  const hasProgress =
    state.tasks.length > 0 || !!state.qaResults || !!state.testSummary;
  const showWaiting = !hasBlockingContent && !hasProgress;
  const showSpecsPanel = !!state.changeContext?.workspacePath;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {hasTabs && <TabBar />}

      <div className="flex flex-1 overflow-hidden min-w-0">
        {hasActiveTab && <PhaseTimeline />}

        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {hasActiveTab && <ChangeHeader />}
          <ReconnectBanner />

          <div
            className="flex-1 overflow-y-auto p-6 space-y-5"
            data-testid="main-content"
          >
            {hasActiveTab ? (
              <>
                {state.questionBatch && <QuestionCard />}
                {state.gatePending && !state.questionBatch && <GateApprovalCard />}
                {state.tasks.length > 0 && <TaskBoard />}
                {state.qaResults && <QAResultsPanel />}
                {state.testSummary && <TestSummaryPanel />}
                {showWaiting && <WaitingState />}
                {state.history.length > 0 && <AnswerHistory />}
                <ActivityLog />
              </>
            ) : (
              <WaitingState />
            )}
          </div>
        </main>

        {showSpecsPanel && (
          <ResizableSpecPanel data-testid="specs-panel">
            <SpecsArea />
          </ResizableSpecPanel>
        )}
      </div>
    </div>
  );
}

function WaitingState() {
  const { state, appState } = useDashboard();
  const isConnected = state.connectionStatus === "connected";
  const hasNoSessionData = isConnected && Object.keys(appState.tabs).length === 0;

  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-accent-blue"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-1">
        DevFlo Dashboard
      </h2>
      <p className="text-sm text-text-secondary max-w-xs">
        {!isConnected
          ? "Connecting to DevFlo server..."
          : hasNoSessionData
            ? "No session data. Run a DevFlo workflow from your project to see progress here."
            : "The AI agent will send updates here as the SDLC progresses."}
      </p>
    </div>
  );
}

export function App() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
