import { useState } from "react";
import { useDashboard } from "../context/DashboardContext";
import type { ActivityEvent } from "../types";

const typeStyles: Record<ActivityEvent["eventType"], string> = {
  info: "text-accent-blue",
  success: "text-accent-green",
  warning: "text-accent-yellow",
  error: "text-accent-red",
};

const typeIcons: Record<ActivityEvent["eventType"], string> = {
  info: "\u2139",
  success: "\u2713",
  warning: "\u26A0",
  error: "\u2717",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ActivityLog() {
  const { state } = useDashboard();
  const [expanded, setExpanded] = useState(false);

  if (state.events.length === 0) return null;

  const filteredEvents = state.selectedPhaseFilter
    ? state.events.filter((e) => e.phase === state.selectedPhaseFilter)
    : state.events;

  const displayEvents = expanded
    ? [...filteredEvents].reverse()
    : [...filteredEvents].reverse().slice(0, 5);

  return (
    <div className="bg-surface-1 border border-surface-border rounded-xl">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors"
      >
        <span>
          Activity Log {state.selectedPhaseFilter && `(${state.selectedPhaseFilter})`}{" "}
          ({filteredEvents.length})
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className="px-5 pb-4 space-y-1">
        {displayEvents.length === 0 && state.selectedPhaseFilter && (
          <p className="text-text-muted text-xs italic py-2">
            No events for {state.selectedPhaseFilter} phase yet.
          </p>
        )}
        
        {displayEvents.map((event) => (
          <div key={event.id} className="flex items-start gap-2 py-1">
            <span className={`text-xs shrink-0 ${typeStyles[event.eventType]}`}>
              {typeIcons[event.eventType]}
            </span>
            <span className="text-[10px] font-mono text-text-muted shrink-0 w-16 pt-px">
              {formatTime(event.timestamp)}
            </span>
            <span className="text-[10px] font-bold uppercase text-text-muted shrink-0 w-16 pt-px truncate">
              {event.agent}
            </span>
            <span className="text-xs text-text-secondary flex-1">
              {event.message}
            </span>
          </div>
        ))}

        {!expanded && filteredEvents.length > 5 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs text-accent-blue hover:underline"
          >
            Show {filteredEvents.length - 5} more...
          </button>
        )}
      </div>
    </div>
  );
}
