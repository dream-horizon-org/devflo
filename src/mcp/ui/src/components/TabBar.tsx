import { useState } from "react";
import { useDashboard } from "../context/DashboardContext";

export function TabBar() {
  const { appState, setActiveTab, closeTab } = useDashboard();
  const [confirmingClose, setConfirmingClose] = useState<string | null>(null);

  const tabIds = Object.keys(appState.tabs);
  if (tabIds.length === 0) return null;

  function handleCloseClick(e: React.MouseEvent, changeId: string) {
    e.stopPropagation();
    setConfirmingClose(changeId);
  }

  function handleConfirmClose() {
    if (confirmingClose) {
      closeTab(confirmingClose);
      setConfirmingClose(null);
    }
  }

  return (
    <>
      <div className="flex items-center bg-surface-0 border-b border-surface-border overflow-x-auto shrink-0">
        {tabIds.map((id) => {
          const tab = appState.tabs[id];
          const isActive = id === appState.activeTabId;
          const needsAttention =
            (tab.questionBatch && !tab.questionBatch.stale) ||
            (tab.gatePending && !tab.gatePending.stale);
          const hasStale =
            (tab.questionBatch?.stale) || (tab.gatePending?.stale);
          const displayName = tab.changeContext?.name ?? tab.changeName ?? id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "border-accent-blue text-text-primary bg-surface-1"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-1/50"
              }`}
            >
              {needsAttention && (
                <span className="w-2 h-2 rounded-full bg-accent-yellow animate-pulse-slow shrink-0" />
              )}
              {hasStale && !needsAttention && (
                <span className="w-2 h-2 rounded-full bg-text-muted shrink-0" />
              )}
              <span className="truncate max-w-[160px]">{displayName}</span>
              {tab.changeContext?.classification && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary shrink-0">
                  {tab.changeContext.classification}
                </span>
              )}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => handleCloseClick(e, id)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setConfirmingClose(id); } }}
                className="ml-1 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-accent-red hover:bg-surface-3 opacity-0 group-hover:opacity-100 transition-all shrink-0"
              >
                &times;
              </span>
            </button>
          );
        })}
      </div>

      {confirmingClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-1 border border-surface-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent-red/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Close this tab?</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {appState.tabs[confirmingClose]?.changeName ?? confirmingClose}
                </p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-6">
              Closing this tab will permanently delete its data. Continue?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingClose(null)}
                className="px-4 py-2 text-sm rounded-lg border border-surface-border text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-red text-white hover:bg-accent-red/90 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
