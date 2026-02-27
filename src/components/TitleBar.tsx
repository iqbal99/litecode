import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEditor } from "../store/editorStore";

interface TitleBarProps {
  onOpenPalette: () => void;
}

// Detect platform once at module load — avoids re-computing per render
const isMac = navigator.userAgent.includes("Macintosh");

const winMinimize = () => void getCurrentWindow().minimize();
const winMaximize = () => void getCurrentWindow().toggleMaximize();
const winClose    = () => void getCurrentWindow().close();

export default function TitleBar({ onOpenPalette }: TitleBarProps) {
  const { state } = useEditor();
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null;

  const label = activeTab
    ? `${activeTab.isDirty ? "● " : ""}${activeTab.fileName}`
    : "LiteCode";

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenPalette();
    },
    [onOpenPalette]
  );

  return (
    <div className="titlebar" data-tauri-drag-region>
      {/* Left zone: 80 px spacer for macOS traffic lights only */}
      {isMac && <div className="titlebar-left" data-tauri-drag-region />}

      {/* Center: command-palette trigger */}
      <div className="titlebar-center">
        <button
          className="titlebar-search"
          onClick={handleClick}
          title="Open Command Palette (⌘P)"
        >
          <span className="titlebar-search-icon">⌘</span>
          <span className="titlebar-search-label">{label}</span>
          <span className="titlebar-search-hint">⌘P</span>
        </button>
      </div>

      {/* Right zone: app label on macOS | custom window controls on Windows/Linux */}
      {isMac ? (
        <div className="titlebar-right" data-tauri-drag-region>
          <span className="titlebar-app-name">LiteCode</span>
        </div>
      ) : (
        <div className="titlebar-right titlebar-right--wc">
          {/* Minimize */}
          <button className="titlebar-wc-btn" onClick={winMinimize} title="Minimize">
            <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor" aria-hidden>
              <rect width="10" height="1" />
            </svg>
          </button>

          {/* Maximize / Restore */}
          <button className="titlebar-wc-btn" onClick={winMaximize} title="Maximize">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                 stroke="currentColor" strokeWidth="1" aria-hidden>
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          </button>

          {/* Close */}
          <button className="titlebar-wc-btn titlebar-wc-close" onClick={winClose} title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10"
                 stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
              <line x1="0" y1="0" x2="10" y2="10" />
              <line x1="10" y1="0" x2="0"  y2="10" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
