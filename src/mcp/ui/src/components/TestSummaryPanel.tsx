import { useDashboard } from "../context/DashboardContext";

export function TestSummaryPanel() {
  const { state } = useDashboard();
  if (!state.testSummary) return null;

  const { commands, suites, total, passed, failed, skipped, integrationResult, notes } =
    state.testSummary;

  const passPct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const failPct = total > 0 ? Math.round((failed / total) * 100) : 0;
  const skipPct = total > 0 ? 100 - passPct - failPct : 0;

  return (
    <div className="bg-surface-1 border border-surface-border rounded-xl p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-4">
        Test Summary
      </h3>

      {/* Stats row */}
      <div className="flex gap-4 mb-4">
        <Stat label="Suites" value={suites} />
        <Stat label="Total" value={total} />
        <Stat label="Passed" value={passed} color="text-accent-green" />
        <Stat label="Failed" value={failed} color={failed > 0 ? "text-accent-red" : undefined} />
        <Stat label="Skipped" value={skipped} color={skipped > 0 ? "text-accent-yellow" : undefined} />
      </div>

      {/* Bar */}
      <div className="w-full h-2.5 bg-surface-3 rounded-full overflow-hidden flex mb-4">
        {passPct > 0 && (
          <div
            className="h-full bg-accent-green transition-all duration-500"
            style={{ width: `${passPct}%` }}
          />
        )}
        {failPct > 0 && (
          <div
            className="h-full bg-accent-red transition-all duration-500"
            style={{ width: `${failPct}%` }}
          />
        )}
        {skipPct > 0 && (
          <div
            className="h-full bg-accent-yellow transition-all duration-500"
            style={{ width: `${skipPct}%` }}
          />
        )}
      </div>

      {/* Commands */}
      {commands.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
            Commands
          </p>
          {commands.map((cmd, i) => (
            <p key={i} className="text-xs font-mono text-text-secondary">
              $ {cmd}
            </p>
          ))}
        </div>
      )}

      {/* Integration result */}
      {integrationResult && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
            Integration
          </p>
          <p className="text-xs text-text-secondary">{integrationResult}</p>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
            Notes
          </p>
          <p className="text-xs text-text-secondary">{notes}</p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${color ?? "text-text-primary"}`}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
    </div>
  );
}
