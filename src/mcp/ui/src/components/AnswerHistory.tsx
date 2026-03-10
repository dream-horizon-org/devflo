import { useState } from "react";
import { useDashboard } from "../context/DashboardContext";

export function AnswerHistory() {
  const { state } = useDashboard();
  const [expanded, setExpanded] = useState(false);

  if (state.history.length === 0) return null;

  return (
    <div className="border-t border-surface-border pt-4 mt-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors w-full"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Answer History ({state.history.length})
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {state.history.map((entry, i) => (
            <div
              key={i}
              className="bg-surface-2 rounded-lg px-3 py-2 text-sm"
            >
              <p className="text-text-secondary text-xs">Q{i + 1}: {entry.questionPrompt}</p>
              <p className="text-accent-green font-medium mt-0.5">{entry.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
