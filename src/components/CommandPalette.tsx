import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import * as monaco from "monaco-editor";
import { Database, File, FileCode2, FileJson2, FileText, Palette, Search, Terminal } from "lucide-react";
import { useEditor } from "../store/editorStore";
import {
  newFile,
  openFile,
  openFilePath,
  saveFile,
  saveFileAs,
  closeTab,
} from "../commands/fileOps";
import { cycleTheme } from "../commands/theme";
import { sc } from "../utils/platform";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaletteMode = "file" | "command" | "text";

interface ModeEntry {
  id: string;
  label: string;
  tag: string;
  shortcut?: string[];
}

interface AppCommand {
  id: string;
  label: string;
  shortcut?: string[];
  action: () => void;
}

interface FileItem {
  label: string;
  path: string;
  kind: "open" | "recent";
}

interface TextResult {
  tabId: string;
  fileName: string;
  lineNumber: number;
  lineContent: string;
}

interface CommandPaletteProps {
  visible: boolean;
  prefill?: string;
  onClose: () => void;
}

// ─── Static mode menu ─────────────────────────────────────────────────────────

function getModes(): ModeEntry[] {
  return [
    { id: "goto-file",   label: "Go to File",                tag: "",      shortcut: sc("⌘", "Ctrl").split("+").concat(["P"]) },
    { id: "run-command", label: "Show and Run Commands",     tag: ">",     shortcut: sc("⇧,⌘,P", "Ctrl,Shift,P").split(",") },
    { id: "search-text", label: "Search Text in Open Files", tag: "%" },
  ];
}
const MODES: ModeEntry[] = getModes();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectMode(query: string): { mode: PaletteMode; term: string } {
  if (query.startsWith(">")) return { mode: "command", term: query.slice(1).trimStart() };
  if (query.startsWith("%")) return { mode: "text",    term: query.slice(1).trimStart() };
  return { mode: "file", term: query };
}

function basename(p: string) {
  return p.split(/[\\/]/).pop() ?? p;
}

function dirname(p: string) {
  const parts = p.split(/[\\/]/);
  parts.pop();
  return parts.join("/") || "/";
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "rb", "php", "c", "cpp"].includes(ext)) {
    return <FileCode2 size={14} aria-hidden />;
  }
  if (["json", "toml", "yaml", "yml"].includes(ext)) {
    return <FileJson2 size={14} aria-hidden />;
  }
  if (["sql"].includes(ext)) {
    return <Database size={14} aria-hidden />;
  }
  if (["css", "scss", "less"].includes(ext)) {
    return <Palette size={14} aria-hidden />;
  }
  if (["sh"].includes(ext)) {
    return <Terminal size={14} aria-hidden />;
  }
  if (["md", "txt", "log", "xml", "html"].includes(ext)) {
    return <FileText size={14} aria-hidden />;
  }
  return <File size={14} aria-hidden />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommandPalette({ visible, prefill = "", onClose }: CommandPaletteProps) {
  const { state, dispatch, editorRef } = useEditor();

  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef                = useRef<HTMLInputElement>(null);
  const listRef                 = useRef<HTMLDivElement>(null);
  // Ref mirrors selected state — lets keyboard handler always read the latest value
  // without being recreated on every selection change.
  const selectedRef             = useRef(0);

  const syncSelected = (n: number) => {
    selectedRef.current = n;
    setSelected(n);
  };

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null;

  // ── Commands ──────────────────────────────────────────────────────────────

  const appCommands = useMemo<AppCommand[]>(
    () => [
      {
        id: "new-file", label: "New File", shortcut: sc("⌘,N", "Ctrl,N").split(","),
        action: () => newFile(dispatch),
      },
      {
        id: "open-file", label: "Open File…", shortcut: sc("⌘,O", "Ctrl,O").split(","),
        action: () => openFile(dispatch),
      },
      {
        id: "save", label: "Save", shortcut: sc("⌘,S", "Ctrl,S").split(","),
        action: () => {
          if (!activeTab) return;
          activeTab.filePath ? saveFile(activeTab, dispatch) : saveFileAs(activeTab, dispatch);
        },
      },
      {
        id: "save-as", label: "Save As…", shortcut: sc("⇧,⌘,S", "Ctrl,Shift,S").split(","),
        action: () => { if (activeTab) saveFileAs(activeTab, dispatch); },
      },
      {
        id: "close-tab", label: "Close Editor", shortcut: sc("⌘,W", "Ctrl,W").split(","),
        action: () => { if (activeTab) closeTab(activeTab, dispatch); },
      },
      {
        id: "cycle-theme", label: "Toggle Theme",
        action: () => cycleTheme(state.theme, dispatch),
      },
      {
        id: "toggle-wordwrap", label: "Toggle Word Wrap",
        action: () => {
          const next = state.wordWrap === "on" ? "off" : "on";
          dispatch({ type: "SET_WORD_WRAP", wordWrap: next as "on" | "off" });
        },
      },
      {
        id: "toggle-minimap", label: "Toggle Minimap",
        action: () => {
          dispatch({ type: "SET_MINIMAP", minimap: !state.minimap });
        },
      },
      {
        id: "increase-font", label: "Increase Font Size", shortcut: sc("⌘,=", "Ctrl,=").split(","),
        action: () => {
          const next = Math.min(state.fontSize + 1, 72);
          dispatch({ type: "SET_FONT_SIZE", fontSize: next });
        },
      },
      {
        id: "decrease-font", label: "Decrease Font Size", shortcut: sc("⌘,-", "Ctrl,-").split(","),
        action: () => {
          const next = Math.max(state.fontSize - 1, 8);
          dispatch({ type: "SET_FONT_SIZE", fontSize: next });
        },
      },
      {
        id: "reset-font", label: "Reset Font Size", shortcut: sc("⌘,0", "Ctrl,0").split(","),
        action: () => {
          dispatch({ type: "SET_FONT_SIZE", fontSize: 14 });
        },
      },
      {
        id: "format-document", label: "Format Document", shortcut: sc("⇧,⌥,F", "Shift,Alt,F").split(","),
        action: () => {
          const editor = editorRef.current;
          editor?.getAction("editor.action.formatDocument")?.run();
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.theme, state.wordWrap, state.minimap, state.fontSize, activeTab, dispatch, editorRef]
  );

  // ── Derived / filtered lists ───────────────────────────────────────────────

  const { mode, term } = useMemo(() => detectMode(query), [query]);
  const showModes      = query === "";

  const fileItems = useMemo<FileItem[]>(() => {
    const open: FileItem[] = state.tabs
      .filter((t) => t.filePath)
      .map((t) => ({ label: t.fileName, path: t.filePath!, kind: "open" }));
    const openPaths = new Set(open.map((i) => i.path));
    const recent: FileItem[] = state.recentFiles
      .filter((p) => !openPaths.has(p))
      .map((p) => ({ label: basename(p), path: p, kind: "recent" }));
    return [...open, ...recent];
  }, [state.tabs, state.recentFiles]);

  const filteredFiles = useMemo<FileItem[]>(() => {
    if (!term) return fileItems.slice(0, 12);
    const q = term.toLowerCase();
    return fileItems
      .filter((f) => f.label.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .slice(0, 12);
  }, [term, fileItems]);

  const filteredCommands = useMemo<AppCommand[]>(() => {
    if (!term) return appCommands;
    const q = term.toLowerCase();
    return appCommands.filter((c) => c.label.toLowerCase().includes(q));
  }, [term, appCommands]);

  const textResults = useMemo<TextResult[]>(() => {
    if (mode !== "text" || !term) return [];
    const q = term.toLowerCase();
    const results: TextResult[] = [];
    for (const tab of state.tabs) {
      const m = monaco.editor.getModel(monaco.Uri.parse(tab.modelUri));
      if (!m) continue;
      const lines = m.getLinesContent();
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          results.push({
            tabId: tab.id,
            fileName: tab.fileName,
            lineNumber: i + 1,
            lineContent: lines[i].trim().slice(0, 100),
          });
          if (results.length >= 50) return results;
        }
      }
    }
    return results;
  }, [mode, term, state.tabs]);

  // Total navigable item count
  const totalItems = useMemo(() => {
    if (showModes)          return MODES.length + Math.min(filteredFiles.length, 6);
    if (mode === "command") return filteredCommands.length;
    if (mode === "text")    return textResults.length;
    return filteredFiles.length;
  }, [showModes, mode, filteredFiles.length, filteredCommands.length, textResults.length]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      setQuery(prefill);
      syncSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [visible, prefill]);

  // Reset selection whenever the query (and therefore the list) changes
  useEffect(() => { syncSelected(0); }, [query]);

  // Auto-scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(".cp-selected");
    item?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const runFile = useCallback((item: FileItem) => {
    onClose();
    requestAnimationFrame(() => openFilePath(item.path, dispatch));
  }, [dispatch, onClose]);

  const runCommand = useCallback((cmd: AppCommand) => {
    onClose();
    requestAnimationFrame(() => cmd.action());
  }, [onClose]);

  const runTextResult = useCallback((result: TextResult) => {
    onClose();
    const targetTabId = result.tabId;
    const targetLine = result.lineNumber;
    requestAnimationFrame(() => {
      dispatch({ type: "SET_ACTIVE_TAB", tabId: targetTabId });
      setTimeout(() => {
        const ed = editorRef.current;
        if (ed) {
          ed.revealLineInCenter(targetLine);
          ed.setPosition({ lineNumber: targetLine, column: 1 });
          ed.focus();
        }
      }, 80);
    });
  }, [dispatch, editorRef, onClose]);

  // Activate a mode entry: if it has a prefix-tag, switch to that mode;
  // if it's "goto-file" (no tag) we're already in file mode — do nothing special.
  const runMode = useCallback((m: ModeEntry) => {
    if (m.tag) {
      setQuery(m.tag);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, []);

  // Activate whichever item is currently selected
  const activateSelected = useCallback(() => {
    const idx = selectedRef.current;

    if (showModes) {
      if (idx < MODES.length) {
        runMode(MODES[idx]);
      } else {
        const fi = filteredFiles[idx - MODES.length];
        if (fi) runFile(fi);
      }
      return;
    }

    if (mode === "command") {
      const cmd = filteredCommands[idx];
      if (cmd) runCommand(cmd);
      return;
    }

    if (mode === "text") {
      const r = textResults[idx];
      if (r) runTextResult(r);
      return;
    }

    // file mode
    const fi = filteredFiles[idx];
    if (fi) runFile(fi);
  }, [showModes, mode, filteredFiles, filteredCommands, textResults,
      runFile, runCommand, runMode, runTextResult]);

  // ── Keyboard handler ───────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        onClose();
        break;

      case "ArrowDown":
        e.preventDefault();
        if (totalItems > 0) syncSelected((selectedRef.current + 1) % totalItems);
        break;

      case "ArrowUp":
        e.preventDefault();
        if (totalItems > 0) syncSelected((selectedRef.current - 1 + totalItems) % totalItems);
        break;

      case "Enter":
        e.preventDefault();
        activateSelected();
        break;
    }
  }, [totalItems, onClose, activateSelected]);

  if (!visible) return null;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const kbd = (keys?: string[]) =>
    keys ? (
      <span className="cp-shortcut">
        {keys.map((k, i) => <kbd key={i}>{k}</kbd>)}
      </span>
    ) : null;

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-panel" onClick={(e) => e.stopPropagation()}>

        {/* ── Input row ── */}
        <div className="cp-input-row">
          <Search className="cp-search-icon" size={16} aria-hidden />
          <input
            ref={inputRef}
            className="cp-input"
            type="text"
            placeholder="Search files · > commands · % text search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="cp-list" ref={listRef}>

          {/* ── Default (empty query): mode menu + recent files ── */}
          {showModes && (
            <>
              {MODES.map((m, i) => (
                <div
                  key={m.id}
                  className={`cp-item${i === selected ? " cp-selected" : ""}`}
                  onClick={() => runMode(m)}
                  onMouseEnter={() => syncSelected(i)}
                >
                  <span className="cp-item-label">{m.label}</span>
                  {m.tag && <span className="cp-mode-tag">{m.tag}</span>}
                  {kbd(m.shortcut)}
                </div>
              ))}

              {filteredFiles.length > 0 && (
                <>
                  <div className="cp-section-header">recently opened</div>
                  {filteredFiles.slice(0, 6).map((f, i) => {
                    const globalIdx = MODES.length + i;
                    return (
                      <div
                        key={f.path}
                        className={`cp-item${globalIdx === selected ? " cp-selected" : ""}`}
                        onClick={() => runFile(f)}
                        onMouseEnter={() => syncSelected(globalIdx)}
                      >
                        <span className="cp-file-icon">{getFileIcon(f.label)}</span>
                        <span className="cp-item-label">{f.label}</span>
                        <span className="cp-file-dir">{dirname(f.path)}</span>
                        {f.kind === "open" && <span className="cp-badge">open</span>}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {/* ── Command mode (>) ── */}
          {!showModes && mode === "command" && (
            <>
              {filteredCommands.length === 0 && (
                <div className="cp-empty">No commands match "{term}"</div>
              )}
              {filteredCommands.map((cmd, i) => (
                <div
                  key={cmd.id}
                  className={`cp-item${i === selected ? " cp-selected" : ""}`}
                  onClick={() => runCommand(cmd)}
                  onMouseEnter={() => syncSelected(i)}
                >
                  <span className="cp-item-label">{cmd.label}</span>
                  {kbd(cmd.shortcut)}
                </div>
              ))}
            </>
          )}

          {/* ── File search mode ── */}
          {!showModes && mode === "file" && (
            <>
              {filteredFiles.length === 0 && (
                <div className="cp-empty">No files match "{term}"</div>
              )}
              {filteredFiles.map((f, i) => (
                <div
                  key={f.path}
                  className={`cp-item${i === selected ? " cp-selected" : ""}`}
                  onClick={() => runFile(f)}
                  onMouseEnter={() => syncSelected(i)}
                >
                  <span className="cp-file-icon">{getFileIcon(f.label)}</span>
                  <span className="cp-item-label">{f.label}</span>
                  <span className="cp-file-dir">{dirname(f.path)}</span>
                  {f.kind === "open" && <span className="cp-badge">open</span>}
                </div>
              ))}
            </>
          )}

          {/* ── Text search mode (%) ── */}
          {!showModes && mode === "text" && (
            <>
              {!term && (
                <div className="cp-empty">Type a term to search in open files</div>
              )}
              {term && textResults.length === 0 && (
                <div className="cp-empty">No matches for "{term}" in open files</div>
              )}
              {textResults.map((r, i) => (
                <div
                  key={`${r.tabId}-${r.lineNumber}`}
                  className={`cp-item${i === selected ? " cp-selected" : ""}`}
                  onClick={() => runTextResult(r)}
                  onMouseEnter={() => syncSelected(i)}
                >
                  <span className="cp-file-icon">{getFileIcon(r.fileName)}</span>
                  <span className="cp-item-label">
                    {r.lineContent || <em style={{ opacity: 0.45 }}>empty line</em>}
                  </span>
                  <span className="cp-file-dir">{r.fileName}:{r.lineNumber}</span>
                </div>
              ))}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
