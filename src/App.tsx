import { useEffect, useCallback, useState, useRef } from "react";
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
import { loadSettings, saveSettings, saveSetting } from "./commands/settingsService";
import { loadRecentFiles } from "./store/recentFiles";
import TabBar from "./components/TabBar";
import Editor from "./components/Editor";
import StatusBar from "./components/StatusBar";
import Welcome from "./components/Welcome";
import CommandPalette from "./components/CommandPalette";
import TitleBar from "./components/TitleBar";
import ToolBar from "./components/ToolBar";
import Settings from "./components/Settings";

function App() {
  const { state, dispatch, editorRef } = useEditor();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePrefill, setPalettePrefill] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const openPalette = useCallback((prefill = "") => {
    setPalettePrefill(prefill);
    setPaletteOpen(true);
  }, []);

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null;

  // Refs for stable event handlers that need latest state
  const stateRef = useRef(state);
  stateRef.current = state;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const settingsLoaded = useRef(false);

  // Load persisted settings + recent files on mount
  useEffect(() => {
    (async () => {
      const persisted = await loadSettings();
      // Legacy fields
      dispatch({ type: "SET_THEME", theme: persisted.theme });
      dispatch({ type: "SET_FONT_SIZE", fontSize: persisted.fontSize });
      dispatch({ type: "SET_WORD_WRAP", wordWrap: persisted.wordWrap });
      dispatch({ type: "SET_MINIMAP", minimap: persisted.minimap });
      // Additional EditorSettings
      const { theme: _t, fontSize: _fs, wordWrap: _ww, minimap: _mm, ...editorSettings } = persisted;
      dispatch({ type: "LOAD_SETTINGS", settings: editorSettings });
      settingsLoaded.current = true;
      const recent = await loadRecentFiles();
      dispatch({ type: "SET_RECENT_FILES", recentFiles: recent });
    })();
  }, [dispatch]);

  // Auto-save all settings whenever they change (after initial load)
  useEffect(() => {
    if (!settingsLoaded.current) return;
    saveSettings({
      ...state.settings,
      theme: state.theme,
      fontSize: state.fontSize,
      wordWrap: state.wordWrap,
      minimap: state.minimap,
    });
  }, [state.theme, state.fontSize, state.wordWrap, state.minimap, state.settings]);

  // Sync native window theme with app theme (affects window borders/chrome on Windows)
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const nativeTheme = state.theme === "vs" ? "light" as const : "dark" as const;
    appWindow.setTheme(nativeTheme).catch(console.error);
  }, [state.theme]);

  // Update window title
  useEffect(() => {
    const appWindow = getCurrentWindow();
    if (activeTab && !activeTab.isSettings) {
      const dirty = activeTab.isDirty ? "● " : "";
      const path = activeTab.filePath ?? activeTab.fileName;
      appWindow.setTitle(`${dirty}${path} — LiteCode`);
    } else if (activeTab?.isSettings) {
      appWindow.setTitle("Settings — LiteCode");
    } else {
      appWindow.setTitle("LiteCode");
    }
  }, [activeTab?.fileName, activeTab?.filePath, activeTab?.isDirty, activeTab?.isSettings]);

  // Keyboard shortcuts — stable handler using refs to avoid listener churn
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const s = stateRef.current;
      const at = activeTabRef.current;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "n") {
        e.preventDefault();
        newFile(dispatch);
      } else if (mod && e.key === "o") {
        e.preventDefault();
        openFile(dispatch);
      } else if (mod && e.shiftKey && e.key === "s") {
        e.preventDefault();
        if (at && !at.isSettings) saveFileAs(at, dispatch);
      } else if (mod && e.key === "s") {
        e.preventDefault();
        if (at && !at.isSettings) {
          at.filePath
            ? saveFile(at, dispatch)
            : saveFileAs(at, dispatch);
        }
      } else if (mod && e.key === "w") {
        e.preventDefault();
        if (s.activeTabId) {
          const tab = s.tabs.find((t) => t.id === s.activeTabId);
          if (tab) {
            if (tab.isSettings) {
              dispatch({ type: "CLOSE_SETTINGS" });
            } else {
              closeTab(tab, dispatch);
            }
          }
        }
      } else if (mod && e.shiftKey && e.key === "p") {
        // ⇧⌘P → Monaco's own command palette (editor actions)
        e.preventDefault();
        editorRef.current?.trigger("", "editor.action.quickCommand", null);
      } else if (mod && e.key === "p") {
        // ⌘P → custom file/app palette (centered)
        e.preventDefault();
        openPalette("");
      } else if (e.ctrlKey && !e.metaKey && e.key === "g") {
        // ⌃G → Monaco's built-in go-to-line dialog
        e.preventDefault();
        editorRef.current?.getAction("editor.action.gotoLine")?.run();
      } else if (mod && e.key === "=") {
        e.preventDefault();
        const next = Math.min(s.fontSize + 1, 40);
        dispatch({ type: "SET_FONT_SIZE", fontSize: next });
        saveSetting("fontSize", next);
      } else if (mod && e.key === "-") {
        e.preventDefault();
        const next = Math.max(s.fontSize - 1, 8);
        dispatch({ type: "SET_FONT_SIZE", fontSize: next });
        saveSetting("fontSize", next);
      } else if (mod && e.key === "0") {
        e.preventDefault();
        dispatch({ type: "SET_FONT_SIZE", fontSize: 14 });
        saveSetting("fontSize", 14);
      } else if (mod && e.key === ",") {
        e.preventDefault();
        dispatch({ type: s.isSettingsOpen ? "CLOSE_SETTINGS" : "OPEN_SETTINGS" });
      }

      // Tab switching: Cmd+1..9
      if (mod && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (s.tabs[idx]) {
          dispatch({ type: "SET_ACTIVE_TAB", tabId: s.tabs[idx].id });
        }
      }

      // Ctrl+Tab / Ctrl+Shift+Tab: cycle through tabs
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const idx = s.tabs.findIndex((t) => t.id === s.activeTabId);
        if (idx >= 0 && s.tabs.length > 1) {
          const next = e.shiftKey
            ? (idx - 1 + s.tabs.length) % s.tabs.length
            : (idx + 1) % s.tabs.length;
          dispatch({ type: "SET_ACTIVE_TAB", tabId: s.tabs[next].id });
        }
      }
    },
    [dispatch, openPalette, editorRef]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
    [dispatch]
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
  }, [dispatch]);

  // Warn before closing with unsaved changes — stable via stateRef
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (stateRef.current.tabs.some((t) => t.isDirty)) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const hasOpenTabs = state.tabs.length > 0;
  const isSettingsActive = activeTab?.isSettings === true;
  const hasRealTabs = state.tabs.some((t) => !t.isSettings);

  return (
    <div
      className={`app ${dragOver ? "drag-over" : ""}`}
      data-theme={state.theme}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TitleBar onOpenPalette={() => openPalette("")} />
      <ToolBar />
      {hasOpenTabs && <TabBar />}
      <div className="editor-area">
        {isSettingsActive && <Settings />}
        {/* Keep Editor in the DOM when real tabs exist so Monaco never unmounts */}
        <div className={`editor-slot${isSettingsActive ? " editor-slot--hidden" : ""}`}>
          {hasRealTabs ? <Editor /> : <Welcome />}
        </div>
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
