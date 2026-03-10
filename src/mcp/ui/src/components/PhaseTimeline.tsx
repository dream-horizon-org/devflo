import { useDashboard } from "../context/DashboardContext";
import type { Phase } from "../types";

const statusConfig = {
  completed: {
    dot: "bg-accent-green",
    line: "bg-accent-green",
    icon: (
      <svg
        className="w-3.5 h-3.5 text-surface-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  active: {
    dot: "bg-accent-blue animate-pulse-slow",
    line: "bg-surface-border",
    icon: null,
  },
  pending: {
    dot: "bg-surface-3",
    line: "bg-surface-border",
    icon: null,
  },
  skipped: {
    dot: "bg-surface-3 opacity-40",
    line: "bg-surface-border opacity-40",
    icon: (
      <svg
        className="w-3 h-3 text-text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
      </svg>
    ),
  },
} as const;

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function GateIndicator({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent-green/20">
        <svg
          className="w-2.5 h-2.5 text-accent-green"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent-yellow/20 animate-pulse-slow">
        <svg
          className="w-2.5 h-2.5 text-accent-yellow"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v.01M12 9v3"
          />
        </svg>
      </span>
    );
  }
  return null;
}

function PhaseItem({ 
  phase, 
  isLast, 
  isSelected, 
  onClick 
}: { 
  phase: Phase; 
  isLast: boolean; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = statusConfig[phase.status];
  const isActive = phase.status === "active";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 w-full text-left transition-all duration-200 px-2 py-1 -mx-2 rounded-lg ${
        isSelected ? "bg-accent-blue/10 ring-1 ring-accent-blue/30" : "hover:bg-surface-2"
      }`}
    >
      <div className="flex flex-col items-center">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${config.dot} ${
            isSelected ? "ring-2 ring-accent-blue/50" : ""
          }`}
        >
          {config.icon}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 h-8 transition-all duration-300 ${config.line}`}
          />
        )}
      </div>
      <div className="pt-0.5 min-w-0 flex-1">
        <div className="flex items-center">
          <span
            className={`text-sm transition-colors duration-300 ${
              isSelected
                ? "text-accent-blue font-semibold"
                : isActive
                  ? "text-accent-blue font-semibold"
                  : phase.status === "completed"
                    ? "text-accent-green"
                    : phase.status === "skipped"
                      ? "text-text-muted line-through"
                      : "text-text-secondary"
            }`}
          >
            {phase.name}
          </span>
          {phase.gateStatus && <GateIndicator status={phase.gateStatus} />}
        </div>

        {/* Sub-progress bar */}
        {phase.subProgress && isActive && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-16 h-1 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-blue rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((phase.subProgress.current / phase.subProgress.total) * 100)}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-text-muted">
              {phase.subProgress.label}
            </span>
          </div>
        )}

        {/* Timestamp */}
        {phase.startedAt && phase.status !== "pending" && (
          <span className="text-[10px] text-text-muted block mt-0.5">
            {phase.completedAt
              ? formatRelativeTime(phase.completedAt)
              : `started ${formatRelativeTime(phase.startedAt)}`}
          </span>
        )}
      </div>
    </button>
  );
}

export function PhaseTimeline() {
  const { state, setPhaseFilter } = useDashboard();

  const completedCount = state.phases.filter(
    (p) => p.status === "completed",
  ).length;
  const totalCount = state.phases.length;

  const handlePhaseClick = (phaseName: string) => {
    if (state.selectedPhaseFilter === phaseName) {
      setPhaseFilter(null);
    } else {
      setPhaseFilter(phaseName);
    }
  };

  return (
    <aside className="w-60 shrink-0 bg-surface-1 border-r border-surface-border p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          Phases
        </h2>
        {totalCount > 0 && (
          <span className="text-[10px] text-text-muted">
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      {state.selectedPhaseFilter && (
        <button
          type="button"
          onClick={() => setPhaseFilter(null)}
          className="mb-3 text-[10px] text-accent-blue hover:underline text-left"
        >
          Show all phases
        </button>
      )}

      <div className="flex-1 overflow-y-auto">
        {state.phases.map((phase, i) => (
          <PhaseItem
            key={phase.name}
            phase={phase}
            isLast={i === state.phases.length - 1}
            isSelected={state.selectedPhaseFilter === phase.name}
            onClick={() => handlePhaseClick(phase.name)}
          />
        ))}

        {state.phases.length === 0 && (
          <p className="text-text-muted text-sm italic">
            Waiting for SDLC to start...
          </p>
        )}
      </div>
    </aside>
  );
}
