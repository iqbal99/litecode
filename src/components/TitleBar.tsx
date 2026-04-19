import { useCallback, useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { Command, Maximize2, Minimize2, Search, X } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { isMac, sc } from "../utils/platform";

interface TitleBarProps {
  onOpenPalette: () => void;
  onRequestClose?: () => unknown | Promise<unknown>;
}

const winMinimize = () => { getCurrentWindow().minimize().catch(console.error); };
const winMaximize = () => { getCurrentWindow().toggleMaximize().catch(console.error); };
const winClose    = () => { getCurrentWindow().close().catch(console.error); };

export default function TitleBar({ onOpenPalette, onRequestClose }: TitleBarProps) {
  const handleRequestClose = useCallback(() => {
    if (onRequestClose) {
      void onRequestClose();
      return;
    }
    winClose();
  }, [onRequestClose]);

  const tabs = useAppSelector((s) => s.editor.tabs);
  const activeTabId = useAppSelector((s) => s.editor.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then((v) => { if (!cancelled) setAppVersion(v); })
      .catch(() => { if (!cancelled) setAppVersion(""); });
    return () => { cancelled = true; };
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
      {isMac && <div className="titlebar-left" data-tauri-drag-region />}

      <div className="titlebar-center">
        <button
          className="titlebar-search"
          onClick={handleClick}
          title={`Files & App Commands (${sc("⌘P", "Ctrl+P")}) · ${sc("⇧⌘P", "Ctrl+Shift+P")} for editor commands`}
          aria-label="Open command palette"
        >
          <span className="titlebar-search-icon"><Search size={13} aria-hidden /></span>
          <span className="titlebar-search-label">{label}</span>
          <span className="titlebar-search-hint"><Command size={12} aria-hidden />{sc("P", "Ctrl+P")}</span>
          <span className="titlebar-search-hint">{sc("⇧⌘P", "Ctrl+⇧+P")}</span>
        </button>
      </div>

      {isMac ? (
        <div className="titlebar-right" data-tauri-drag-region>
          <span className="titlebar-app-name">LiteCode{appVersion ? `  v${appVersion}` : ""}</span>
        </div>
      ) : (
        <div className="titlebar-right titlebar-right--wc">
          {appVersion && <span className="titlebar-app-name" style={{ marginRight: 8 }}>v{appVersion}</span>}
          <button className="titlebar-wc-btn" onClick={winMinimize} title="Minimize" aria-label="Minimize window">
            <Minimize2 size={13} aria-hidden />
          </button>
          <button className="titlebar-wc-btn" onClick={winMaximize} title="Maximize" aria-label="Maximize window">
            <Maximize2 size={13} aria-hidden />
          </button>
          <button className="titlebar-wc-btn titlebar-wc-close" onClick={handleRequestClose} title="Close" aria-label="Close window">
            <X size={13} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
