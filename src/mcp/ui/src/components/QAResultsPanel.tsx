import { useDashboard } from "../context/DashboardContext";
import type { QAFinding } from "../types";

const severityConfig: Record<
  QAFinding["severity"],
  { label: string; color: string; bg: string }
> = {
  blocker: {
    label: "BLOCKER",
    color: "text-accent-red",
    bg: "bg-accent-red/20",
  },
  major: {
    label: "MAJOR",
    color: "text-accent-yellow",
    bg: "bg-accent-yellow/20",
  },
  minor: {
    label: "MINOR",
    color: "text-accent-blue",
    bg: "bg-accent-blue/20",
  },
  nit: {
    label: "NIT",
    color: "text-text-muted",
    bg: "bg-surface-3",
  },
};

export function QAResultsPanel() {
  const { state } = useDashboard();
  if (!state.qaResults) return null;

  const { verdict, findings, summary } = state.qaResults;
  const verdictColor =
    verdict === "pass"
      ? "text-accent-green"
      : verdict === "fail"
        ? "text-accent-red"
        : "text-accent-yellow";
  const verdictBg =
    verdict === "pass"
      ? "bg-accent-green/20"
      : verdict === "fail"
        ? "bg-accent-red/20"
        : "bg-accent-yellow/20";

  const counts = {
    blocker: findings.filter((f) => f.severity === "blocker").length,
    major: findings.filter((f) => f.severity === "major").length,
    minor: findings.filter((f) => f.severity === "minor").length,
    nit: findings.filter((f) => f.severity === "nit").length,
  };

  return (
    <div className="bg-surface-1 border border-surface-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
          QA Review
        </h3>
        <span
          className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${verdictBg} ${verdictColor}`}
        >
          QA {verdict.toUpperCase()}
        </span>
      </div>

      {summary && (
        <p className="text-sm text-text-secondary mb-4">{summary}</p>
      )}

      {findings.length > 0 && (
        <>
          <div className="flex gap-3 mb-3">
            {(
              Object.entries(counts) as [QAFinding["severity"], number][]
            ).map(
              ([sev, count]) =>
                count > 0 && (
                  <span
                    key={sev}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityConfig[sev].bg} ${severityConfig[sev].color}`}
                  >
                    {count} {severityConfig[sev].label}
                  </span>
                ),
            )}
          </div>

          <div className="space-y-2">
            {findings.map((f) => {
              const cfg = severityConfig[f.severity];
              return (
                <div
                  key={f.id}
                  className="bg-surface-2 rounded-lg px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                    {f.fixType && (
                      <span className="text-[10px] text-text-muted uppercase">
                        {f.fixType}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary">{f.description}</p>
                  {f.file && (
                    <p className="text-xs text-text-muted font-mono mt-1">
                      {f.file}
                      {f.line != null ? `:${f.line}` : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
