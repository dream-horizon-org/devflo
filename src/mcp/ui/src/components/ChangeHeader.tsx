import { useDashboard } from "../context/DashboardContext";

const classificationColors: Record<string, string> = {
  Trivial: "bg-surface-3 text-text-secondary",
  "Bug Fix": "bg-accent-red/20 text-accent-red",
  "Small Change": "bg-accent-yellow/20 text-accent-yellow",
  "New Feature": "bg-accent-blue/20 text-accent-blue",
  "Major Refactor": "bg-accent-purple/20 text-accent-purple",
};

const confidenceColors: Record<string, string> = {
  HIGH: "text-accent-green",
  MEDIUM: "text-accent-yellow",
  LOW: "text-accent-red",
};

const confidenceIcons: Record<string, string> = {
  HIGH: "✓",
  MEDIUM: "~",
  LOW: "!",
};

function openProjectInCursor(projectPath: string): void {
  try {
    const path = projectPath.startsWith("/") ? projectPath : `/${projectPath}`;
    window.open(`vscode://file${path}`, "_blank");
  } catch {
    navigator.clipboard?.writeText(projectPath).catch(() => {});
  }
}

export function ChangeHeader() {
  const { state, appState } = useDashboard();

  const name = state.changeContext?.name ?? state.changeName;
  const classification =
    state.changeContext?.classification ?? state.classification;
  const pipeline = state.changeContext?.pipeline;
  const confidence = state.changeContext?.confidence ?? state.confidence;
  const projectPath = appState.projectPath;

  if (!name && !classification) return null;

  const badgeClass =
    classificationColors[classification] ?? "bg-surface-3 text-text-secondary";

  const activePhase = state.phases.find((p) => p.status === "active");
  const currentTask = state.tasks.find((t) => t.status === "in_progress");
  const completedPhases = state.phases.filter(
    (p) => p.status === "completed",
  ).length;
  const totalPhases = state.phases.length;

  return (
    <div className="shrink-0 bg-surface-1 border-b border-surface-border">
      <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
        {name && (
          <span className="text-sm font-mono font-semibold text-text-primary">
            {name}
          </span>
        )}
        {classification && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeClass}`}
          >
            {classification}
          </span>
        )}
        {confidence && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 ${confidenceColors[confidence] ?? "text-text-muted"}`}
          >
            {confidenceIcons[confidence]} {confidence}
          </span>
        )}
        {pipeline && (
          <span className="text-[10px] font-mono text-text-muted">
            Pipeline: {pipeline}
          </span>
        )}
        {projectPath && (
          <button
            type="button"
            onClick={() => openProjectInCursor(projectPath)}
            className="ml-auto text-[10px] font-medium text-accent-blue hover:text-accent-blue/80 px-2 py-1 rounded border border-surface-border hover:border-accent-blue/50 transition-colors"
          >
            Open in Cursor
          </button>
        )}
      </div>

      {(activePhase || currentTask || state.currentFile) && (
        <div className="px-5 pb-2 flex items-center gap-2 text-[10px] text-text-muted flex-wrap">
          {activePhase && (
            <span className="font-medium text-text-secondary">
              Phase: {activePhase.name}
            </span>
          )}
          {currentTask && (
            <span>
              Task: {currentTask.title}
            </span>
          )}
          {state.currentFile && (
            <span className="truncate max-w-[200px]" title={state.currentFile}>
              File: {state.currentFile}
            </span>
          )}
        </div>
      )}

      {activePhase && totalPhases > 0 && (
        <div className="px-5 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
              Current Phase: {activePhase.name}
            </span>
            <span className="text-[10px] text-text-muted">
              {completedPhases}/{totalPhases} Complete
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-blue to-accent-green rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((completedPhases / totalPhases) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
