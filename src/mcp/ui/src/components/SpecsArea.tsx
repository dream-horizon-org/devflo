import { useState, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useDashboard } from "../context/DashboardContext";

const FILE_LABELS: Record<string, string> = {
  "proposal.md": "Proposal",
  "design.md": "Design",
  "tasks.md": "Tasks",
  ".openspec.yaml": "OpenSpec Config",
};

interface FileListEntry {
  name: string;
  mtime?: string;
}

function getBaseUrl(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function fetchFileList(dir: string): Promise<FileListEntry[]> {
  const url = `${getBaseUrl()}/api/files/list?dir=${encodeURIComponent(dir)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const raw = data.files ?? [];
  return raw.map((f: string | FileListEntry) =>
    typeof f === "string" ? { name: f } : { name: f.name, mtime: f.mtime }
  );
}

async function fetchFileContent(filePath: string): Promise<string | null> {
  const url = `${getBaseUrl()}/api/files?path=${encodeURIComponent(filePath)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.content ?? null;
}

function getDefaultFileIndex(files: FileListEntry[], gate: string | undefined): number {
  if (files.length === 0) return 0;
  if (gate === "A") {
    const i = files.findIndex((f) => f.name === "proposal.md");
    return i >= 0 ? i : 0;
  }
  if (gate === "B") {
    const i = files.findIndex((f) => f.name === "design.md");
    return i >= 0 ? i : 0;
  }
  return 0;
}

export function SpecsArea() {
  const { state, appState } = useDashboard();
  const workspacePath = state.changeContext?.workspacePath ?? "";
  const gate = state.gatePending?.gate;
  const tasks = state.tasks;
  const projectPath = appState.projectPath;

  const [files, setFiles] = useState<FileListEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refetchList = useCallback(() => {
    if (!workspacePath) return;
    fetchFileList(workspacePath).then((list) => {
      setFiles(list);
      const defaultIdx = getDefaultFileIndex(list, gate);
      setActiveIndex((prev) => (prev >= list.length ? defaultIdx : prev));
    });
  }, [workspacePath, gate]);

  const activeFile = files[activeIndex];
  const activeFilePath = activeFile ? `${workspacePath}/${activeFile.name}`.replace(/\/\//g, "/") : null;

  const loadContent = useCallback(async (filePath: string) => {
    setLoading(true);
    const text = await fetchFileContent(filePath);
    setContent(text);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!workspacePath) return;
    refetchList();
  }, [workspacePath, refetchList]);

  useEffect(() => {
    if (files.length === 0) return;
    setActiveIndex((prev) => {
      const defaultIdx = getDefaultFileIndex(files, gate);
      return prev >= files.length ? defaultIdx : prev;
    });
  }, [files.length]);

  useEffect(() => {
    if (files.length > 0) {
      setActiveIndex(getDefaultFileIndex(files, gate));
    }
  }, [gate]);

  useEffect(() => {
    if (activeFilePath) loadContent(activeFilePath);
  }, [activeFilePath, loadContent]);

  const handleRefresh = useCallback(() => {
    refetchList();
    if (activeFilePath) loadContent(activeFilePath);
  }, [refetchList, activeFilePath, loadContent]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && workspacePath) {
        refetchList();
        if (activeFilePath) loadContent(activeFilePath);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [workspacePath, activeFilePath, refetchList, loadContent]);

  const latestMtime = useMemo(() => {
    const mtimes = files.map((f) => f.mtime).filter(Boolean) as string[];
    if (mtimes.length === 0) return null;
    return mtimes.reduce((a, b) => (a > b ? a : b));
  }, [files]);

  const taskProgress = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    return total > 0 ? { completed, total } : null;
  }, [tasks]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => { });
  }, []);

  const changeFolderPath = projectPath && workspacePath ? `${projectPath.replace(/\/$/, "")}/${workspacePath.replace(/^\//, "")}` : "";

  if (!workspacePath) {
    return (
      <div className="p-4">
        <p className="text-sm text-text-muted">No workspace path.</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-text-muted">Loading spec files…</p>
      </div>
    );
  }

  const isMarkdown = activeFile?.name.endsWith(".md") ?? false;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Summary card */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-surface-border bg-surface-2/30">
        {taskProgress && (
          <span className="text-xs text-text-secondary">
            Tasks: {taskProgress.completed}/{taskProgress.total}
          </span>
        )}
        {latestMtime && (
          <span className="text-xs text-text-muted">
            Latest: {formatRelativeTime(latestMtime)}
          </span>
        )}
      </div>

      {/* Tabs + Refresh + Open in Cursor (Specs-area) */}
      <div className="shrink-0 flex flex-wrap items-center gap-1 px-3 py-2 border-b border-surface-border">
        {files.map((f, i) => {
          const isActive = i === activeIndex;
          const label = FILE_LABELS[f.name] ?? f.name;
          const filePath = `${workspacePath}/${f.name}`.replace(/\/\//g, "/");
          const absPath = projectPath ? `${projectPath.replace(/\/$/, "")}/${filePath.replace(/^\//, "")}` : filePath;
          return (
            <div key={f.name} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`shrink-0 px-2 py-1 text-xs rounded transition-colors ${isActive ? "bg-accent-purple/20 text-accent-purple font-medium" : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
                  }`}
              >
                {label}
              </button>
              {f.mtime && (
                <span className="text-[10px] text-text-muted" title={f.mtime}>
                  {formatRelativeTime(f.mtime)}
                </span>
              )}
              <button
                type="button"
                onClick={() => copyToClipboard(absPath)}
                className="p-0.5 text-text-muted hover:text-text-secondary rounded"
                title="Copy path"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-3M8 5a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2a2 2 0 00-2 2m0 0h2a2 2 0 012 2v0m0 4v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V9a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh"
            className="p-1.5 text-text-muted hover:text-text-primary rounded"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {changeFolderPath && (
            <button
              type="button"
              onClick={() => copyToClipboard(changeFolderPath)}
              title="Copy change folder path"
              className="text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded"
            >
              Copy folder path
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-text-muted text-sm">Loading…</div>
        ) : content === null ? (
          <div className="flex items-center justify-center py-8 text-text-muted text-sm">Could not load file</div>
        ) : isMarkdown ? (
          <div className="px-4 py-3 prose prose-invert prose-sm max-w-none text-sm text-text-secondary leading-relaxed">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <pre className="px-4 py-3 text-xs text-text-secondary font-mono whitespace-pre-wrap overflow-x-auto">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
