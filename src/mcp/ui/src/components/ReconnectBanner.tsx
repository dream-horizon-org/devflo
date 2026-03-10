import { useDashboard } from "../context/DashboardContext";

function formatLastUpdate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ReconnectBanner() {
  const { state, appState, requestFullState } = useDashboard();

  if (state.connectionStatus === "connecting") {
    return (
      <div className="px-4 py-2 text-center text-xs font-medium bg-accent-yellow/20 text-accent-yellow">
        Connecting to DevFlo server...
      </div>
    );
  }

  if (state.connectionStatus === "disconnected") {
    return (
      <div className="px-4 py-2 text-center text-xs font-medium bg-accent-red/20 text-accent-red">
        Disconnected — reconnecting...
      </div>
    );
  }

  return (
    <div className="px-4 py-1.5 flex items-center justify-center gap-3 text-xs text-text-muted">
      {appState.lastUpdate && (
        <span>Last update: {formatLastUpdate(appState.lastUpdate)}</span>
      )}
      <button
        type="button"
        onClick={() => requestFullState()}
        className="text-accent-blue hover:underline focus:outline-none focus:ring-1 focus:ring-accent-blue rounded"
      >
        Reload session
      </button>
    </div>
  );
}
