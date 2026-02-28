import { useEffect, useCallback, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import { useEditor } from "./store/editorStore";
import {
  newFile,
  openFile,
  openFilePath,
  saveFile,
  saveFileAs,
  closeTab,
} from "./commands/fileOps";
import { loadSettings, saveSetting } from "./commands/theme";
import { loadRecentFiles } from "./store/recentFiles";
import TabBar from "./components/TabBar";
import Editor from "./components/Editor";
import StatusBar from "./components/StatusBar";
import Welcome from "./components/Welcome";
import CommandPalette from "./components/CommandPalette";
import TitleBar from "./components/TitleBar";
import ToolBar from "./components/ToolBar";

function App() {
  const { state, dispatch } = useEditor();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePrefill, setPalettePrefill] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const openPalette = useCallback((prefill = "") => {
    setPalettePrefill(prefill);
    setPaletteOpen(true);
  }, []);

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null;

  // Load persisted settings + recent files on mount
  useEffect(() => {
    (async () => {
      const settings = await loadSettings();
      dispatch({ type: "SET_THEME", theme: settings.theme });
      dispatch({ type: "SET_FONT_SIZE", fontSize: settings.fontSize });
      dispatch({ type: "SET_WORD_WRAP", wordWrap: settings.wordWrap });
      dispatch({ type: "SET_MINIMAP", minimap: settings.minimap });
      const recent = await loadRecentFiles();
      dispatch({ type: "SET_RECENT_FILES", recentFiles: recent });
    })();
  }, [dispatch]);

  // Update window title
  useEffect(() => {
    const appWindow = getCurrentWindow();
    if (activeTab) {
      const dirty = activeTab.isDirty ? "● " : "";
      const path = activeTab.filePath ?? activeTab.fileName;
      appWindow.setTitle(`${dirty}${path} — LiteCode`);
    } else {
      appWindow.setTitle("LiteCode");
    }
  }, [activeTab?.fileName, activeTab?.filePath, activeTab?.isDirty]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "n") {
        e.preventDefault();
        newFile(dispatch);
      } else if (mod && e.key === "o") {
        e.preventDefault();
        openFile(dispatch);
      } else if (mod && e.shiftKey && e.key === "s") {
        e.preventDefault();
        if (activeTab) saveFileAs(activeTab, dispatch);
      } else if (mod && e.key === "s") {
        e.preventDefault();
        if (activeTab) {
          activeTab.filePath
            ? saveFile(activeTab, dispatch)
            : saveFileAs(activeTab, dispatch);
        }
      } else if (mod && e.key === "w") {
        e.preventDefault();
        if (state.activeTabId) {
          const tab = state.tabs.find((t) => t.id === state.activeTabId);
          if (tab) closeTab(tab, dispatch);
        }
      } else if (mod && e.shiftKey && e.key === "p") {
        e.preventDefault();
        openPalette(">");
      } else if (mod && e.key === "p") {
        e.preventDefault();
        openPalette("");
      } else if (e.ctrlKey && !e.metaKey && e.key === "g") {
        e.preventDefault();
        openPalette(":");
      } else if (mod && e.key === "=") {
        e.preventDefault();
        const next = Math.min(state.fontSize + 1, 40);
        dispatch({ type: "SET_FONT_SIZE", fontSize: next });
        saveSetting("fontSize", next);
      } else if (mod && e.key === "-") {
        e.preventDefault();
        const next = Math.max(state.fontSize - 1, 8);
        dispatch({ type: "SET_FONT_SIZE", fontSize: next });
        saveSetting("fontSize", next);
      } else if (mod && e.key === "0") {
        e.preventDefault();
        dispatch({ type: "SET_FONT_SIZE", fontSize: 14 });
        saveSetting("fontSize", 14);
      }

      // Tab switching: Cmd+1..9
      if (mod && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (state.tabs[idx]) {
          dispatch({ type: "SET_ACTIVE_TAB", tabId: state.tabs[idx].id });
        }
      }

      // Ctrl+Tab / Ctrl+Shift+Tab: cycle through tabs
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
        if (idx >= 0 && state.tabs.length > 1) {
          const next = e.shiftKey
            ? (idx - 1 + state.tabs.length) % state.tabs.length
            : (idx + 1) % state.tabs.length;
          dispatch({ type: "SET_ACTIVE_TAB", tabId: state.tabs[next].id });
        }
      }
    },
    [state, dispatch, activeTab, openPalette]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Commands inside the palette reopen it with a prefill via this custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const prefill = (e as CustomEvent).detail?.prefill ?? "";
      openPalette(prefill);
    };
    window.addEventListener("litecode:open-palette", handler);
    return () => window.removeEventListener("litecode:open-palette", handler);
  }, [openPalette]);

  // Drag-and-drop files onto the window
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      // Tauri fires file drop events via the window
      // For HTML5 drag-and-drop fallback
      const files = e.dataTransfer?.files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // @ts-expect-error webkitRelativePath or path from Tauri
          const path = file.path || file.name;
          if (path) {
            await openFilePath(path, dispatch);
          }
        }
      }
    },
    [state, dispatch]
  );

  // Tauri v2 file drop events
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    appWindow
      .onDragDropEvent(async (event) => {
        if (event.payload.type === "over") {
          setDragOver(true);
        } else if (event.payload.type === "drop") {
          setDragOver(false);
          for (const path of event.payload.paths) {
            await openFilePath(path, dispatch);
          }
        } else {
          setDragOver(false);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [state, dispatch]);

  // Warn before closing with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.tabs.some((t) => t.isDirty)) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.tabs]);

  const hasOpenTabs = state.tabs.length > 0;

  return (
    <div
      className={`app ${dragOver ? "drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TitleBar onOpenPalette={() => openPalette("")} />
      <ToolBar />
      {hasOpenTabs && <TabBar />}
      <div className="editor-area">
        {hasOpenTabs ? <Editor /> : <Welcome />}
      </div>
      <StatusBar />
      <CommandPalette
        visible={paletteOpen}
        prefill={palettePrefill}
        onClose={() => setPaletteOpen(false)}
      />
      {dragOver && (
        <div className="drop-overlay">
          <div className="drop-message">Drop files to open</div>
        </div>
      )}
    </div>
  );
}

export default App;
