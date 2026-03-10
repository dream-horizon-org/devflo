import { useDashboard } from "../context/DashboardContext";
import type { TaskItem } from "../types";

const statusConfig: Record<
  TaskItem["status"],
  { icon: string; color: string; bg: string }
> = {
  pending: { icon: "\u25CB", color: "text-text-muted", bg: "" },
  in_progress: {
    icon: "\u25D4",
    color: "text-accent-blue",
    bg: "bg-accent-blue/5 border-accent-blue/30",
  },
  completed: { icon: "\u2713", color: "text-accent-green", bg: "" },
  failed: { icon: "\u2717", color: "text-accent-red", bg: "bg-accent-red/5 border-accent-red/30" },
  cancelled: { icon: "\u2014", color: "text-text-muted", bg: "opacity-50" },
};

export function TaskBoard() {
  const { state } = useDashboard();
  if (state.tasks.length === 0) return null;

  const completed = state.tasks.filter((t) => t.status === "completed").length;
  const total = state.tasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-surface-1 border border-surface-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
          Tasks
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">
            {completed}/{total}
          </span>
          <div className="w-24 h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-green rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {state.tasks.map((task) => {
          const cfg = statusConfig[task.status];
          return (
            <div
              key={task.id}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border border-transparent transition-colors ${cfg.bg}`}
            >
              <span className={`text-base leading-5 shrink-0 ${cfg.color}`}>
                {cfg.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    task.status === "cancelled"
                      ? "text-text-muted line-through"
                      : task.status === "in_progress"
                        ? "text-accent-blue"
                        : task.status === "completed"
                          ? "text-accent-green"
                          : "text-text-primary"
                  }`}
                >
                  #{task.id} {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-text-secondary mt-0.5 truncate">
                    {task.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
