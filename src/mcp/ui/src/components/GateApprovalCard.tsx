import { useState } from "react";
import { useDashboard } from "../context/DashboardContext";
import { RichTextEditor } from "./RichTextEditor";

export function GateApprovalCard() {
  const { state, submitGateAction } = useDashboard();
  const [feedback, setFeedback] = useState("");

  if (!state.gatePending) return null;

  const isStale = !!state.gatePending.stale;
  const { gate, phaseName, summary } = state.gatePending;
  const gateLabel =
    gate === "A" ? "Gate A — PM Approval" : "Gate B — Architect Approval";
  const approveText = gate === "A" ? "PM APPROVED" : "ARCH APPROVED";
  const reviseText = gate === "A" ? "PM REVISE" : "ARCH REVISE";
  const hasFeedback = feedback.trim().length > 0;

  return (
    <div className={`bg-surface-1 border-2 rounded-xl p-6 ${isStale ? "border-text-muted/30 opacity-70" : "border-accent-yellow/40"}`}>
      {isStale && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-surface-2 rounded-lg text-xs text-text-secondary">
          <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Session expired — this gate approval is from a previous server session and can no longer be acted upon.
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-accent-yellow/20 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-accent-yellow"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            {gateLabel}
          </h2>
          <p className="text-xs text-text-secondary">
            {phaseName} phase is complete — review and approve to continue
          </p>
        </div>
      </div>

      {summary && (
        <div className="bg-surface-2 rounded-lg px-4 py-3 mb-5 text-sm text-text-secondary leading-relaxed">
          {summary}
        </div>
      )}

      {/* Revision feedback section */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Revision feedback (optional — rich text with Markdown output)
        </label>
        <RichTextEditor
          value={feedback}
          onChange={setFeedback}
          placeholder='Describe what should change — e.g. "Clarify the scope of X, add Y to acceptance criteria…"'
          accentColor="yellow"
        />
      </div>

      {/* Action buttons */}
      <div className={`flex flex-wrap items-center gap-3 ${isStale ? "pointer-events-none opacity-40" : ""}`}>
        <button
          type="button"
          onClick={() => submitGateAction("approve")}
          disabled={isStale}
          className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-accent-green text-surface-0 hover:bg-accent-green/90 disabled:cursor-not-allowed transition-colors"
        >
          {isStale ? "Expired" : approveText}
        </button>

        {hasFeedback ? (
          <button
            type="button"
            onClick={() =>
              submitGateAction("revise", feedback.trim())
            }
            disabled={isStale}
            className="px-4 py-2.5 text-sm font-medium rounded-lg bg-accent-yellow/20 border border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/30 disabled:cursor-not-allowed transition-colors"
          >
            Send feedback &amp; {reviseText}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submitGateAction("revise")}
            disabled={isStale}
            className="px-4 py-2.5 text-sm font-medium rounded-lg border border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/10 disabled:cursor-not-allowed transition-colors"
            title="Return to Cursor and type your revision feedback in chat"
          >
            {reviseText} — I'll type in Cursor
          </button>
        )}

        <button
          type="button"
          onClick={() => submitGateAction("cancel")}
          disabled={isStale}
          className="px-4 py-2.5 text-sm font-medium rounded-lg border border-surface-border text-text-secondary hover:text-accent-red hover:border-accent-red/50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel Change
        </button>
      </div>
    </div>
  );
}
