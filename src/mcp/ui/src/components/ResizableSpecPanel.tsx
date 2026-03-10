import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_WIDTH = "devflo-specs-panel-width";
const STORAGE_KEY_COLLAPSED = "devflo-specs-panel-collapsed";
const MIN_WIDTH = 240;
const DEFAULT_WIDTH = 360;
const MAX_WIDTH_PCT = 0.6;

function getStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  const raw = window.localStorage.getItem(STORAGE_KEY_WIDTH);
  if (raw === null) return DEFAULT_WIDTH;
  const n = Number(raw);
  return Number.isFinite(n) && n >= MIN_WIDTH ? n : DEFAULT_WIDTH;
}

function getStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
}

export interface ResizableSpecPanelProps {
  children: React.ReactNode;
  "data-testid"?: string;
}

export function ResizableSpecPanel({
  children,
  "data-testid": dataTestId = "specs-panel",
}: ResizableSpecPanelProps) {
  const [width, setWidth] = useState(getStoredWidth);
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (collapsed) return;
    window.localStorage.setItem(STORAGE_KEY_WIDTH, String(width));
  }, [width, collapsed]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed));
  }, [collapsed]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const docWidth = document.documentElement.clientWidth;
      const maxPx = Math.floor(docWidth * MAX_WIDTH_PCT);
      const newWidth = docWidth - e.clientX;
      const clamped = Math.max(MIN_WIDTH, Math.min(maxPx, newWidth));
      setWidth(clamped);
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const panelWidth = collapsed ? 0 : width;
  const showHandle = !collapsed;

  return (
    <>
      {showHandle && (
        <button
          type="button"
          aria-label={isDragging ? "Resizing panel" : "Drag to resize Specs panel"}
          className="shrink-0 w-1.5 hover:w-2 bg-surface-border hover:bg-accent-purple/50 transition-all cursor-col-resize flex items-stretch focus:outline-none focus:ring-0"
          onMouseDown={handleMouseDown}
          data-testid="specs-panel-resize-handle"
        />
      )}
      <aside
        data-testid={dataTestId}
        className="flex flex-col h-full bg-surface-1 border-l border-surface-border overflow-hidden shrink-0"
        style={{
          width: panelWidth ? `${panelWidth}px` : undefined,
          minWidth: collapsed ? 0 : MIN_WIDTH,
        }}
      >
        {!collapsed && (
          <>
            <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border shrink-0">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Specs
              </span>
              <button
                type="button"
                aria-label="Collapse Specs panel"
                onClick={toggleCollapsed}
                className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto min-w-0">{children}</div>
          </>
        )}
      </aside>
      {collapsed && (
        <button
          type="button"
          aria-label="Expand Specs panel"
          onClick={toggleCollapsed}
          className="shrink-0 flex flex-col items-center justify-center w-8 bg-surface-2 border-l border-surface-border hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
          data-testid="specs-panel-expand"
        >
          <svg
            className="w-4 h-4 rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
        </button>
      )}
    </>
  );
}
