import { useCallback, useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { Command, Maximize2, Minimize2, Search, X } from "lucide-react";
import { useEditor } from "../store/editorStore";
import { isMac, sc } from "../utils/platform";

interface TitleBarProps {
  onOpenPalette: () => void;
}

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
          title={`Files & App Commands (${sc("⌘P", "Ctrl+P")}) · ${sc("⇧⌘P", "Ctrl+Shift+P")} for editor commands`}
        >
          <span className="titlebar-search-icon"><Search size={13} aria-hidden /></span>
          <span className="titlebar-search-label">{label}</span>
          <span className="titlebar-search-hint"><Command size={12} aria-hidden />{sc("P", "Ctrl+P")}</span>
          <span className="titlebar-search-hint">{sc("⇧⌘P", "Ctrl+⇧+P")}</span>
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
            <Minimize2 size={13} aria-hidden />
          </button>

          {/* Maximize / Restore */}
          <button className="titlebar-wc-btn" onClick={winMaximize} title="Maximize">
            <Maximize2 size={13} aria-hidden />
          </button>

          {/* Close */}
          <button className="titlebar-wc-btn titlebar-wc-close" onClick={winClose} title="Close">
            <X size={13} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
