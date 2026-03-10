import { useCallback, useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { useEditor } from "../store/editorStore";

interface TitleBarProps {
  onOpenPalette: () => void;
}

// Detect platform once at module load — avoids re-computing per render
const isMac = navigator.userAgent.includes("Macintosh");

const winMinimize = () => { getCurrentWindow().minimize().catch(console.error); };
const winMaximize = () => { getCurrentWindow().toggleMaximize().catch(console.error); };
const winClose    = () => { getCurrentWindow().close().catch(console.error); };

export default function TitleBar({ onOpenPalette }: TitleBarProps) {
  const { state } = useEditor();
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null;
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion(""));
  }, []);

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
          title="Files & App Commands (⌘P) · ⇧⌘P for editor commands"
        >
          <span className="titlebar-search-icon">⌘</span>
          <span className="titlebar-search-label">{label}</span>
          <span className="titlebar-search-hint">⌘P</span>
          <span className="titlebar-search-hint">⇧⌘P</span>
        </button>
      </div>

      {/* Right zone: app label on macOS | custom window controls on Windows/Linux */}
      {isMac ? (
        <div className="titlebar-right" data-tauri-drag-region>
          <span className="titlebar-app-name">LiteCode{appVersion ? `  v${appVersion}` : ""}</span>
        </div>
      ) : (
        <div className="titlebar-right titlebar-right--wc">
          {appVersion && <span className="titlebar-app-name" style={{ marginRight: 8 }}>v{appVersion}</span>}
          {/* Minimize */}
          <button className="titlebar-wc-btn" onClick={winMinimize} title="Minimize">
            <svg width="12" height="2" viewBox="0 0 12 2" fill="currentColor" aria-hidden>
              <rect width="12" height="1.5" y="0.25" rx="0.5" />
            </svg>
          </button>

          {/* Maximize / Restore */}
          <button className="titlebar-wc-btn" onClick={winMaximize} title="Maximize">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
                 stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <rect x="0.6" y="0.6" width="9.8" height="9.8" rx="0.5" />
            </svg>
          </button>

          {/* Close */}
          <button className="titlebar-wc-btn titlebar-wc-close" onClick={winClose} title="Close">
            <svg width="12" height="12" viewBox="0 0 12 12"
                 stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1"  y2="11" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
