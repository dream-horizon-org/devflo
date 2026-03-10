import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface FileViewerProps {
  workspacePath: string;
}

interface FileEntry {
  name: string;
  path: string;
  mtime?: string;
}

const FILE_LABELS: Record<string, string> = {
  "proposal.md": "Proposal",
  "design.md": "Design",
  "tasks.md": "Tasks",
  ".openspec.yaml": "OpenSpec Config",
};

function getBaseUrl(): string {
  return window.location.origin;
}

interface FileListEntry {
  name: string;
  mtime?: string;
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

export function FileViewer({ workspacePath }: FileViewerProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!workspacePath) return;
    fetchFileList(workspacePath).then((list) => {
      const entries: FileEntry[] = list.map((f) => ({
        name: f.name,
        path: `${workspacePath}/${f.name}`.replace(/\/\//g, "/"),
        mtime: f.mtime,
      }));
      setFiles(entries);
      if (entries.length > 0 && !activeFile) {
        setActiveFile(entries[0].path);
      }
    });
  }, [workspacePath]);

  const loadContent = useCallback(async (filePath: string) => {
    setActiveFile(filePath);
    setLoading(true);
    const text = await fetchFileContent(filePath);
    setContent(text);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeFile) loadContent(activeFile);
  }, [activeFile, loadContent]);

  const handleRefresh = useCallback(() => {
    if (activeFile) loadContent(activeFile);
  }, [activeFile, loadContent]);

  if (!workspacePath || files.length === 0) return null;

  const isMarkdown = activeFile?.endsWith(".md") ?? false;

  return (
    <div className="bg-surface-1 border border-surface-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-2 transition-colors"
      >
        <svg
          className={`w-4 h-4 text-text-muted transition-transform ${collapsed ? "" : "rotate-90"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-4 h-4 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Workspace Files
        </span>
        <span className="text-[10px] text-text-muted font-mono ml-auto">
          {workspacePath}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-surface-border">
          {/* File tabs */}
          <div className="flex items-center gap-1 px-3 py-2 bg-surface-2/50 border-b border-surface-border overflow-x-auto">
            {files.map((f) => {
              const isActive = f.path === activeFile;
              const label = FILE_LABELS[f.name] ?? f.name;
              return (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setActiveFile(f.path)}
                  className={`shrink-0 px-3 py-1.5 text-xs rounded-md transition-colors ${
                    isActive
                      ? "bg-accent-purple/20 text-accent-purple font-medium"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
                  }`}
                >
                  {label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh file content"
              className="ml-auto shrink-0 p-1.5 text-text-muted hover:text-text-secondary rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-text-muted text-sm">
                Loading...
              </div>
            ) : content === null ? (
              <div className="flex items-center justify-center py-8 text-text-muted text-sm">
                Could not load file
              </div>
            ) : isMarkdown ? (
              <div className="px-5 py-4 prose prose-invert prose-sm max-w-none text-sm text-text-secondary leading-relaxed file-viewer-markdown">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            ) : (
              <pre className="px-5 py-4 text-xs text-text-secondary font-mono whitespace-pre-wrap overflow-x-auto">
                {content}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
