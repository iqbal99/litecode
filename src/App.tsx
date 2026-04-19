import { useEffect, useCallback, useState, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { useAppSelector, useAppDispatch } from "./store/hooks";
import { getEditorRef } from "./store/editorRef";
import { store } from "./store/store";
import {
  clearNotification,
  setTheme,
  setFontSize,
  setWordWrap,
  setMinimap,
  setDiagnostics,
  loadSettings as loadSettingsAction,
  setRecentFiles,
  closeSettings,
  openSettings,
  setActiveTab,
} from "./store/editorSlice";
import {
  newFile,
  openFile,
  openFilePath,
  saveFile,
  saveFileAs,
  closeTab,
} from "./commands/fileOps";
import { loadSettings, saveSettings } from "./commands/settingsService";
import { loadRecentFiles } from "./store/recentFiles";
import TabBar from "./components/TabBar";
import Editor from "./components/Editor";
import StatusBar from "./components/StatusBar";
import Welcome from "./components/Welcome";
import CommandPalette from "./components/CommandPalette";
import TitleBar from "./components/TitleBar";
import ToolBar from "./components/ToolBar";
import Settings from "./components/Settings";
import NotificationCenter from "./components/NotificationCenter";
import { showNotification } from "./commands/notifications";
import { resolveUnsavedBeforeExit } from "./commands/appClose";

function App() {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector((s) => s.editor.tabs);
  const activeTabId = useAppSelector((s) => s.editor.activeTabId);
  const notifications = useAppSelector((s) => s.editor.notifications);
  const theme = useAppSelector((s) => s.editor.theme);
  const fontSize = useAppSelector((s) => s.editor.fontSize);
  const wordWrap = useAppSelector((s) => s.editor.wordWrap);
  const minimapEnabled = useAppSelector((s) => s.editor.minimap);
  const diagnosticsEnabled = useAppSelector((s) => s.editor.diagnostics);
  const editorSettings = useAppSelector((s) => s.editor.settings);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePrefill, setPalettePrefill] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const openPalette = useCallback((prefill = "") => {
    setPalettePrefill(prefill);
    setPaletteOpen(true);
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const settingsLoaded = useRef(false);
  const allowNativeCloseRef = useRef(false);
  const closeInProgressRef = useRef(false);

  const dismissedRef = useRef(new Set<number>());
  const notificationTimeoutsRef = useRef(new Map<number, number>());
  useEffect(() => {
    for (const n of notifications) {
      if (dismissedRef.current.has(n.id) || notificationTimeoutsRef.current.has(n.id)) {
        continue;
      }
      dismissedRef.current.add(n.id);
      const timeout = window.setTimeout(() => {
        notificationTimeoutsRef.current.delete(n.id);
        dismissedRef.current.delete(n.id);
        dispatch(clearNotification(n.id));
      }, 4200);
      notificationTimeoutsRef.current.set(n.id, timeout);
    }

    const activeIds = new Set(notifications.map((n) => n.id));
    for (const [id, timeout] of notificationTimeoutsRef.current) {
      if (!activeIds.has(id)) {
        window.clearTimeout(timeout);
        notificationTimeoutsRef.current.delete(id);
        dismissedRef.current.delete(id);
      }
    }
  }, [notifications, dispatch]);

  useEffect(() => {
    return () => {
      for (const timeout of notificationTimeoutsRef.current.values()) {
        window.clearTimeout(timeout);
      }
      notificationTimeoutsRef.current.clear();
      dismissedRef.current.clear();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const persisted = await loadSettings();

      if (!persisted.fontFamily || persisted.fontFamily === "monospace") {
        const preferred = ["Consolas", "Cascadia Mono", "Menlo", "SF Mono", "Monaco"];
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.font = "72px monospace";
          const baseW = ctx.measureText("mmmmmmmmmmlli1|WMwij").width;
          for (const f of preferred) {
            ctx.font = `72px '${f}', monospace`;
            if (ctx.measureText("mmmmmmmmmmlli1|WMwij").width !== baseW) {
              persisted.fontFamily = f;
              break;
            }
          }
        }
      }

      dispatch(setTheme(persisted.theme));
      dispatch(setFontSize(persisted.fontSize));
      dispatch(setWordWrap(persisted.wordWrap));
      dispatch(setMinimap(persisted.minimap));
      dispatch(setDiagnostics(persisted.diagnostics));

      const {
        theme: _t,
        fontSize: _fs,
        wordWrap: _ww,
        minimap: _mm,
        diagnostics: _diag,
        ...rest
      } = persisted;
      dispatch(loadSettingsAction(rest));
      settingsLoaded.current = true;
      const recent = await loadRecentFiles();
      dispatch(setRecentFiles(recent));
    })();
  }, [dispatch]);

  useEffect(() => {
    if (!settingsLoaded.current) return;
    saveSettings({
      ...editorSettings,
      theme,
      fontSize,
      wordWrap,
      minimap: minimapEnabled,
      diagnostics: diagnosticsEnabled,
    });
  }, [theme, fontSize, wordWrap, minimapEnabled, diagnosticsEnabled, editorSettings]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const nativeTheme = theme === "vs" ? "light" as const : "dark" as const;
    appWindow.setTheme(nativeTheme).catch(console.error);
  }, [theme]);

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const s = store.getState().editor;
      const at = s.tabs.find((t) => t.id === s.activeTabId) ?? null;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "n") {
        e.preventDefault();
        newFile(dispatch);
      } else if (mod && e.key === "o") {
        e.preventDefault();
        openFile(dispatch);
      } else if (mod && e.shiftKey && e.key === "s") {
        e.preventDefault();
        if (at && !at.isSettings) {
          void saveFileAs(at, dispatch);
        }
      } else if (mod && e.key === "s") {
        e.preventDefault();
        if (at && !at.isSettings) {
          if (at.filePath) {
            void saveFile(at, dispatch);
          } else {
            void saveFileAs(at, dispatch);
          }
        }
      } else if (mod && e.key === "w") {
        e.preventDefault();
        if (s.activeTabId) {
          const tab = s.tabs.find((t) => t.id === s.activeTabId);
          if (tab) {
            if (tab.isSettings) {
              dispatch(closeSettings());
            } else {
              void closeTab(tab, dispatch);
            }
          }
        }
      } else if (mod && e.shiftKey && e.key === "p") {
        e.preventDefault();
        getEditorRef()?.trigger("", "editor.action.quickCommand", null);
      } else if (mod && e.key === "p") {
        e.preventDefault();
        openPalette("");
      } else if (e.ctrlKey && !e.metaKey && e.key === "g") {
        e.preventDefault();
        getEditorRef()?.getAction("editor.action.gotoLine")?.run();
      } else if (mod && e.key === "=") {
        e.preventDefault();
        dispatch(setFontSize(Math.min(s.fontSize + 1, 72)));
      } else if (mod && e.key === "-") {
        e.preventDefault();
        dispatch(setFontSize(Math.max(s.fontSize - 1, 8)));
      } else if (mod && e.key === "0") {
        e.preventDefault();
        dispatch(setFontSize(14));
      } else if (mod && e.key === ",") {
        e.preventDefault();
        dispatch(s.isSettingsOpen ? closeSettings() : openSettings());
      }

      if (mod && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (s.tabs[idx]) {
          dispatch(setActiveTab(s.tabs[idx].id));
        }
      }

      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const idx = s.tabs.findIndex((t) => t.id === s.activeTabId);
        if (idx >= 0 && s.tabs.length > 1) {
          const next = e.shiftKey
            ? (idx - 1 + s.tabs.length) % s.tabs.length
            : (idx + 1) % s.tabs.length;
          dispatch(setActiveTab(s.tabs[next].id));
        }
      }
    },
    [dispatch, openPalette]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const openAll = (files: unknown) => {
      if (!Array.isArray(files)) return;
      for (const filePath of files) {
        if (typeof filePath === "string" && filePath.length > 0) {
          openFilePath(filePath, dispatch);
        }
      }
    };

    const drainPending = async () => {
      try {
        const files = await invoke<string[]>("take_pending_files");
        if (!cancelled) openAll(files);
      } catch {
        if (!cancelled) {
          showNotification(
            dispatch,
            "error",
            "LiteCode could not restore files passed in on launch."
          );
        }
      }
    };

    // Register the event listener BEFORE draining so an `Opened` event
    // emitted concurrently with startup is not dropped. Then drain once
    // the listener is attached to pick up anything that was queued while
    // we were still setting up.
    listen<string[]>("open-files", (event) => {
      openAll(event.payload);
    })
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        unlisten = fn;
        void drainPending();
      })
      .catch(() => {
        // Even if the listener failed to attach, try to surface anything queued.
        void drainPending();
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [dispatch]);

  const requestAppClose = useCallback(async (): Promise<boolean> => {
    if (closeInProgressRef.current) {
      return false;
    }
    closeInProgressRef.current = true;
    const canClose = await resolveUnsavedBeforeExit(
      () => store.getState().editor,
      dispatch,
      closeTab
    );
    if (!canClose) {
      closeInProgressRef.current = false;
      return false;
    }

    allowNativeCloseRef.current = true;
    try {
      await getCurrentWindow().close();
      return true;
    } catch (err) {
      console.error("Failed to close app window:", err);
      allowNativeCloseRef.current = false;
      closeInProgressRef.current = false;
      return false;
    }
  }, [dispatch]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    appWindow
      .onCloseRequested(async (event) => {
        if (allowNativeCloseRef.current) return;
        event.preventDefault();
        await requestAppClose();
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.error("Failed to install close-request handler:", err);
      });

    return () => {
      unlisten?.();
    };
  }, [requestAppClose]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (store.getState().editor.tabs.some((t) => t.isDirty)) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const hasOpenTabs = tabs.length > 0;
  const isSettingsActive = activeTab?.isSettings === true;
  const hasRealTabs = tabs.some((t) => !t.isSettings);

  return (
    <div
      className={`app ${dragOver ? "drag-over" : ""}`}
      data-theme={theme}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <NotificationCenter />
      <TitleBar onOpenPalette={() => openPalette("")} onRequestClose={requestAppClose} />
      <ToolBar />
      {hasOpenTabs && <TabBar />}
      <div className="editor-area">
        {isSettingsActive && <Settings />}
        <div className={`editor-slot${isSettingsActive ? " editor-slot--hidden" : ""}`}>
          {hasRealTabs ? <Editor /> : isSettingsActive ? null : <Welcome />}
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
