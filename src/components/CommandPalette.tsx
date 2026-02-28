import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import * as monaco from "monaco-editor";
import { useEditor } from "../store/editorStore";
import {
  newFile,
  openFile,
  openFilePath,
  saveFile,
  saveFileAs,
  closeTab,
} from "../commands/fileOps";
import { cycleTheme, saveSetting } from "../commands/theme";

// ─── Types ───────────────────────────────────────────────────────────────────

type PaletteMode = "file" | "command" | "symbol" | "line" | "text" | "lang";

interface ModeEntry {
  id: string;
  prefix: string;
  label: string;
  shortcut?: string[];
  description: string;
}

interface AppCommand {
  id: string;
  label: string;
  shortcut?: string[];
  action: () => void;
}

interface CommandPaletteProps {
  visible: boolean;
  prefill?: string;
  onClose: () => void;
}

// ─── Static mode descriptors (shown when palette is empty) ───────────────────
const MODES: ModeEntry[] = [
  {
    id: "goto-file",
    prefix: "",
    label: "Go to File",
    shortcut: ["⌘", "P"],
    description: "",
  },
  {
    id: "run-command",
    prefix: ">",
    label: "Show and Run Commands",
    shortcut: ["⇧", "⌘", "P"],
    description: ">",
  },
  {
    id: "search-text",
    prefix: "%",
    label: "Search Text in Open Files",
    description: "%",
  },
  {
    id: "goto-symbol",
    prefix: "@",
    label: "Go to Symbol in Editor",
    shortcut: ["⇧", "⌘", "O"],
    description: "@",
  },
  {
    id: "goto-line",
    prefix: ":",
    label: "Go to Line / Column",
    shortcut: ["⌃", "G"],
    description: ":",
  },
  {
    id: "change-language",
    prefix: "lang:",
    label: "Change Language Mode",
    description: "lang:",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectMode(query: string): { mode: PaletteMode; term: string } {
  if (query.startsWith(">")) return { mode: "command", term: query.slice(1).trimStart() };
  if (query.startsWith("@")) return { mode: "symbol", term: query.slice(1) };
  if (query.startsWith(":")) return { mode: "line", term: query.slice(1) };
  if (query.startsWith("%")) return { mode: "text", term: query.slice(1).trimStart() };
  if (query.startsWith("lang:")) return { mode: "lang", term: query.slice(5) };
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

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    ts: "TS", tsx: "⚛", js: "JS", jsx: "⚛", json: "{}", html: "<>",
    css: "◈", scss: "◈", less: "◈", md: "M↓", py: "Py",
    rs: "Rs", go: "Go", java: "Jv", rb: "Rb", php: "Php",
    sh: "$_", sql: "DB", xml: "<>", yaml: "YM", yml: "YM",
    toml: "TM", txt: "T_", log: "L_", c: "C_", cpp: "C+",
  };
  return icons[ext] ?? "F_";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommandPalette({ visible, prefill = "", onClose }: CommandPaletteProps) {
  const { state, dispatch } = useEditor();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null;

  // Grab the first Monaco editor instance available
  const getEditor = useCallback((): monaco.editor.IStandaloneCodeEditor | null => {
    const editors = monaco.editor.getEditors();
    return editors.length > 0 ? (editors[0] as monaco.editor.IStandaloneCodeEditor) : null;
  }, []);

  // ── App commands list ──────────────────────────────────────────────────────
  const appCommands = useMemo<AppCommand[]>(
    () => [
      { id: "new-file",  label: "New File",     shortcut: ["⌘","N"], action: () => newFile(dispatch) },
      { id: "open-file", label: "Open File…",   shortcut: ["⌘","O"], action: () => openFile(dispatch) },
      {
        id: "save",
        label: "Save",
        shortcut: ["⌘","S"],
        action: () => {
          if (activeTab) activeTab.filePath ? saveFile(activeTab, dispatch) : saveFileAs(activeTab, dispatch);
        },
      },
      {
        id: "save-as",
        label: "Save As…",
        shortcut: ["⇧","⌘","S"],
        action: () => { if (activeTab) saveFileAs(activeTab, dispatch); },
      },
      {
        id: "close-tab",
        label: "Close Editor",
        shortcut: ["⌘","W"],
        action: () => { if (activeTab) closeTab(activeTab, dispatch); },
      },
      { id: "cycle-theme",     label: "Toggle Theme",      action: () => cycleTheme(state.theme, dispatch) },
      {
        id: "toggle-wordwrap",
        label: "Toggle Word Wrap",
        action: () => {
          const next = state.wordWrap === "on" ? "off" : "on";
          dispatch({ type: "SET_WORD_WRAP", wordWrap: next as "on" | "off" });
          saveSetting("wordWrap", next);
        },
      },
      {
        id: "toggle-minimap",
        label: "Toggle Minimap",
        action: () => {
          dispatch({ type: "SET_MINIMAP", minimap: !state.minimap });
          saveSetting("minimap", !state.minimap);
        },
      },
      {
        id: "increase-font",
        label: "Increase Font Size",
        shortcut: ["⌘","="],
        action: () => {
          const next = Math.min(state.fontSize + 1, 40);
          dispatch({ type: "SET_FONT_SIZE", fontSize: next });
          saveSetting("fontSize", next);
        },
      },
      {
        id: "decrease-font",
        label: "Decrease Font Size",
        shortcut: ["⌘","-"],
        action: () => {
          const next = Math.max(state.fontSize - 1, 8);
          dispatch({ type: "SET_FONT_SIZE", fontSize: next });
          saveSetting("fontSize", next);
        },
      },
      {
        id: "reset-font",
        label: "Reset Font Size",
        shortcut: ["⌘","0"],
        action: () => { dispatch({ type: "SET_FONT_SIZE", fontSize: 14 }); saveSetting("fontSize", 14); },
      },
      {
        id: "format-doc",
        label: "Format Document",
        shortcut: ["⇧","⌥","F"],
        action: () => getEditor()?.getAction("editor.action.formatDocument")?.run(),
      },
      {
        id: "fold-all",
        label: "Fold All",
        action: () => getEditor()?.getAction("editor.foldAll")?.run(),
      },
      {
        id: "unfold-all",
        label: "Unfold All",
        action: () => getEditor()?.getAction("editor.unfoldAll")?.run(),
      },
      {
        id: "find",
        label: "Find",
        shortcut: ["⌘","F"],
        action: () => getEditor()?.getAction("actions.find")?.run(),
      },
      {
        id: "replace",
        label: "Find and Replace",
        shortcut: ["⌘","H"],
        action: () => getEditor()?.getAction("editor.action.startFindReplaceAction")?.run(),
      },
      {
        id: "toggle-comment",
        label: "Toggle Line Comment",
        shortcut: ["⌘","/"],
        action: () => getEditor()?.getAction("editor.action.commentLine")?.run(),
      },
      {
        id: "select-all",
        label: "Select All",
        shortcut: ["⌘","A"],
        action: () => {
          const ed = getEditor();
          if (ed) { const m = ed.getModel(); if (m) ed.setSelection(m.getFullModelRange()); }
        },
      },
      {
        id: "goto-line-cmd",
        label: "Go to Line / Column…",
        shortcut: ["⌃","G"],
        action: () => {
          onClose();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("litecode:open-palette", { detail: { prefill: ":" } }));
          }, 60);
        },
      },
      {
        id: "goto-symbol-cmd",
        label: "Go to Symbol in Editor…",
        shortcut: ["⇧","⌘","O"],
        action: () => {
          onClose();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("litecode:open-palette", { detail: { prefill: "@" } }));
          }, 60);
        },
      },
      {
        id: "change-language",
        label: "Change Language Mode…",
        action: () => {
          onClose();
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("litecode:open-palette", { detail: { prefill: "lang:" } }));
          }, 60);
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.theme, state.wordWrap, state.minimap, state.fontSize, dispatch, activeTab, getEditor, onClose]
  );

  // ── Mode detection ─────────────────────────────────────────────────────────
  const { mode, term } = useMemo(() => detectMode(query), [query]);
  const showModes = query === "";

  // ── File items (open tabs + recent files) ─────────────────────────────────
  interface FileItem { label: string; path: string; kind: "open" | "recent" }

  const fileItems = useMemo<FileItem[]>(() => {
    const openItems: FileItem[] = state.tabs
      .filter((t) => t.filePath)
      .map((t) => ({ label: t.fileName, path: t.filePath!, kind: "open" }));
    const openPaths = new Set(openItems.map((i) => i.path));
    const recentItems: FileItem[] = state.recentFiles
      .filter((p) => !openPaths.has(p))
      .map((p) => ({ label: basename(p), path: p, kind: "recent" }));
    return [...openItems, ...recentItems];
  }, [state.tabs, state.recentFiles]);

  const filteredFiles = useMemo<FileItem[]>(() => {
    if (!term) return fileItems.slice(0, 12);
    const lower = term.toLowerCase();
    return fileItems
      .filter((f) => f.label.toLowerCase().includes(lower) || f.path.toLowerCase().includes(lower))
      .slice(0, 12);
  }, [term, fileItems]);

  // ── Command filter ─────────────────────────────────────────────────────────
  const filteredCommands = useMemo<AppCommand[]>(() => {
    if (!term) return appCommands;
    const lower = term.toLowerCase();
    return appCommands.filter((c) => c.label.toLowerCase().includes(lower));
  }, [term, appCommands]);

  // ── Symbol search ──────────────────────────────────────────────────────────
  interface SymbolItem { label: string; kind: string; range: monaco.IRange }
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);

  useEffect(() => {
    if (mode !== "symbol" || !visible) { setSymbols([]); return; }
    const ed = getEditor();
    const model = ed?.getModel();
    if (!model) { setSymbols([]); return; }

    let cancelled = false;
    const lang = model.getLanguageId();

    if (lang === "typescript" || lang === "javascript") {
      // Use the TypeScript worker to get navigation items (real symbol list)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tsLang = (monaco.languages as any).typescript;
      if (!tsLang) { setSymbols([]); return; }

      tsLang
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .getTypeScriptWorker()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((getWorker: (uri: monaco.Uri) => Promise<any>) => getWorker(model.uri))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((client: any) => client.getNavigationBarItems(model.uri.toString()))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((items: any[]) => {
          if (cancelled) return;
          const flat: SymbolItem[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const flatten = (nodes: any[]) => {
            for (const item of nodes ?? []) {
              if (item.text && item.text !== "<global>") {
                const span = item.spans?.[0];
                if (span) {
                  const pos = model.getPositionAt(span.start);
                  flat.push({
                    label: item.text,
                    kind: item.kind ?? "symbol",
                    range: {
                      startLineNumber: pos.lineNumber,
                      startColumn: pos.column,
                      endLineNumber: pos.lineNumber,
                      endColumn: pos.column,
                    },
                  });
                }
              }
              if (item.childItems?.length) flatten(item.childItems);
            }
          };
          flatten(items);
          setSymbols(flat);
        })
        .catch(() => { if (!cancelled) setSymbols([]); });
    } else {
      setSymbols([]);
    }
    return () => { cancelled = true; };
  }, [mode, visible, getEditor]);

  const filteredSymbols = useMemo<SymbolItem[]>(() => {
    if (!term) return symbols;
    const lower = term.toLowerCase();
    return symbols.filter((s) => s.label.toLowerCase().includes(lower));
  }, [term, symbols]);

  // ── Text search in open files (% mode) ────────────────────────────────────
  interface TextResult { tabId: string; fileName: string; lineNumber: number; lineContent: string }
  const MAX_TEXT_SEARCH_RESULTS = 50;

  const textResults = useMemo<TextResult[]>(() => {
    if (mode !== "text" || !term) return [];
    const lower = term.toLowerCase();
    const results: TextResult[] = [];
    for (const tab of state.tabs) {
      const m = monaco.editor.getModel(monaco.Uri.parse(tab.modelUri));
      if (!m) continue;
      const lines = m.getLinesContent();
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lower)) {
          results.push({
            tabId: tab.id,
            fileName: tab.fileName,
            lineNumber: i + 1,
            lineContent: lines[i].trim().slice(0, 100),
          });
          if (results.length >= MAX_TEXT_SEARCH_RESULTS) return results;
        }
      }
    }
    return results;
  }, [mode, term, state.tabs]);

  // ── Language picker (lang: mode) ──────────────────────────────────────────
  interface LangItem { id: string; name: string }

  const allLanguages = useMemo<LangItem[]>(() => {
    return monaco.languages
      .getLanguages()
      .map((l) => ({ id: l.id, name: (l.aliases ?? [])[0] ?? l.id }))
      .filter((l) => l.id !== "")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredLanguages = useMemo<LangItem[]>(() => {
    if (mode !== "lang") return [];
    if (!term) return allLanguages.slice(0, 20);
    const lower = term.toLowerCase();
    return allLanguages
      .filter((l) => l.id.toLowerCase().includes(lower) || l.name.toLowerCase().includes(lower))
      .slice(0, 20);
  }, [mode, term, allLanguages]);

  // ── Item counts for keyboard nav ───────────────────────────────────────────
  const totalItems = showModes
    ? MODES.length + Math.min(filteredFiles.length, 6)
    : mode === "command" ? filteredCommands.length
    : mode === "symbol"  ? filteredSymbols.length
    : mode === "line"    ? 1
    : mode === "text"    ? textResults.length
    : mode === "lang"    ? filteredLanguages.length
    : filteredFiles.length;

  // ── Open / close lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setQuery(prefill);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [visible, prefill]);

  useEffect(() => { setSelected(0); }, [query]);

  // ── Run actions ────────────────────────────────────────────────────────────
  const runFile = useCallback((item: FileItem) => {
    onClose();
    requestAnimationFrame(() => openFilePath(item.path, dispatch));
  }, [dispatch, onClose]);

  const runCommand = useCallback((cmd: AppCommand) => {
    onClose();
    requestAnimationFrame(() => cmd.action());
  }, [onClose]);

  const runSymbol = useCallback((sym: SymbolItem) => {
    onClose();
    requestAnimationFrame(() => {
      const ed = getEditor();
      if (ed && sym.range) {
        ed.revealRangeInCenter(sym.range);
        ed.setPosition({ lineNumber: sym.range.startLineNumber, column: sym.range.startColumn });
        ed.focus();
      }
    });
  }, [getEditor, onClose]);

  const runTextResult = useCallback((result: TextResult) => {
    onClose();
    requestAnimationFrame(() => {
      dispatch({ type: "SET_ACTIVE_TAB", tabId: result.tabId });
      // Scroll to the matching line after switching tabs
      setTimeout(() => {
        const ed = getEditor();
        if (ed) {
          ed.revealLineInCenter(result.lineNumber);
          ed.setPosition({ lineNumber: result.lineNumber, column: 1 });
          ed.focus();
        }
      }, 80);
    });
  }, [dispatch, getEditor, onClose]);

  const runLanguage = useCallback((lang: LangItem) => {
    if (!activeTab) { onClose(); return; }
    const m = monaco.editor.getModel(monaco.Uri.parse(activeTab.modelUri));
    if (m) {
      monaco.editor.setModelLanguage(m, lang.id);
      dispatch({ type: "SET_LANGUAGE", tabId: activeTab.id, language: lang.id });
    }
    onClose();
  }, [activeTab, dispatch, onClose]);

  const runLineJump = useCallback(() => {
    const parts = term.split(",");
    const ln = Math.max(parseInt(parts[0]) || 1, 1);
    const col = Math.max(parseInt(parts[1]) || 1, 1);
    onClose();
    requestAnimationFrame(() => {
      const ed = getEditor();
      if (ed) { ed.revealLineInCenter(ln); ed.setPosition({ lineNumber: ln, column: col }); ed.focus(); }
    });
  }, [term, getEditor, onClose]);

  const runMode = useCallback((m: ModeEntry) => {
    if (m.id === "goto-line")        { setQuery(":"); return; }
    if (m.id === "goto-symbol")      { setQuery("@"); return; }
    if (m.id === "run-command")      { setQuery(">"); return; }
    if (m.id === "search-text")      { setQuery("%"); return; }
    if (m.id === "change-language")  { setQuery("lang:"); return; }
    setQuery("");
  }, []);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => (s + 1) % Math.max(totalItems, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => (s - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (mode === "line") { runLineJump(); return; }
        if (showModes) {
          if (selected < MODES.length) runMode(MODES[selected]);
          else {
            const fi = filteredFiles[selected - MODES.length];
            if (fi) runFile(fi);
          }
          return;
        }
        if (mode === "command")  { if (filteredCommands[selected]) runCommand(filteredCommands[selected]); return; }
        if (mode === "symbol")   { if (filteredSymbols[selected])  runSymbol(filteredSymbols[selected]);   return; }
        if (mode === "text")     { if (textResults[selected])      runTextResult(textResults[selected]);   return; }
        if (mode === "lang")     { if (filteredLanguages[selected]) runLanguage(filteredLanguages[selected]); return; }
        if (filteredFiles[selected]) runFile(filteredFiles[selected]);
      }
    },
    [totalItems, mode, selected, showModes, filteredFiles, filteredCommands, filteredSymbols,
     textResults, filteredLanguages,
     runFile, runCommand, runSymbol, runLineJump, runMode, runTextResult, runLanguage, onClose]
  );

  if (!visible) return null;

  // ── Render helpers ─────────────────────────────────────────────────────────
  const renderKbd = (keys?: string[]) =>
    keys && (
      <span className="cp-shortcut">
        {keys.map((k, i) => <kbd key={i}>{k}</kbd>)}
      </span>
    );

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-panel" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>

        {/* ── Input row ── */}
        <div className="cp-input-row">
          <svg className="cp-search-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M6.5 1a5.5 5.5 0 1 0 3.613 9.72l3.082 3.083a.5.5 0 0 0 .707-.708L10.82 10.01A5.5 5.5 0 0 0 6.5 1zm-4.5 5.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0z" />
          </svg>
          <input
            ref={inputRef}
            className="cp-input"
            type="text"
            placeholder="Search files by name (append : for line or @ for symbol)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="cp-list">
          {/* ── Default view: mode list + recently opened ── */}
          {showModes && (
            <>
              {MODES.map((m, i) => (
                <div
                  key={m.id}
                  className={`cp-item ${i === selected ? "cp-selected" : ""}`}
                  onClick={() => runMode(m)}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span className="cp-item-label">{m.label}</span>
                  {m.description && <span className="cp-mode-tag">{m.description}</span>}
                  {renderKbd(m.shortcut)}
                </div>
              ))}

              {filteredFiles.length > 0 && (
                <>
                  <div className="cp-section-header">recently opened</div>
                  {filteredFiles.slice(0, 6).map((f, i) => {
                    const idx = MODES.length + i;
                    return (
                      <div
                        key={f.path}
                        className={`cp-item ${idx === selected ? "cp-selected" : ""}`}
                        onClick={() => runFile(f)}
                        onMouseEnter={() => setSelected(idx)}
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
                  className={`cp-item ${i === selected ? "cp-selected" : ""}`}
                  onClick={() => runCommand(cmd)}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span className="cp-item-label">{cmd.label}</span>
                  {renderKbd(cmd.shortcut)}
                </div>
              ))}
            </>
          )}

          {/* ── Symbol mode (@) ── */}
          {!showModes && mode === "symbol" && (
            <>
              {filteredSymbols.length === 0 && (
                <div className="cp-empty">
                  {term
                    ? `No symbols match "${term}"`
                    : activeTab && activeTab.language !== "typescript" && activeTab.language !== "javascript"
                    ? "Symbol search is available for TypeScript and JavaScript files"
                    : "No symbols found in current file"}
                </div>
              )}
              {filteredSymbols.map((sym, i) => (
                <div
                  key={`${sym.label}-${i}`}
                  className={`cp-item ${i === selected ? "cp-selected" : ""}`}
                  onClick={() => runSymbol(sym)}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span className="cp-symbol-kind">{sym.kind.slice(0, 2)}</span>
                  <span className="cp-item-label">{sym.label}</span>
                  <span className="cp-file-dir">Ln {sym.range?.startLineNumber}</span>
                </div>
              ))}
            </>
          )}

          {/* ── Go-to-line mode (:) ── */}
          {!showModes && mode === "line" && (
            <div className="cp-item cp-selected" onClick={runLineJump}>
              <span className="cp-item-label">
                {term
                  ? `Go to line ${term.split(",")[0]}${term.includes(",") ? `, column ${term.split(",")[1]}` : ""}`
                  : "Type a line number (and optional ,column) then press Enter"}
              </span>
              {term && <span className="cp-badge">↵ jump</span>}
            </div>
          )}

          {/* ── File search mode (default / %) ── */}
          {!showModes && mode === "file" && (
            <>
              {filteredFiles.length === 0 && (
                <div className="cp-empty">No files match "{term}"</div>
              )}
              {filteredFiles.map((f, i) => (
                <div
                  key={f.path}
                  className={`cp-item ${i === selected ? "cp-selected" : ""}`}
                  onClick={() => runFile(f)}
                  onMouseEnter={() => setSelected(i)}
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
                <div className="cp-empty">Type a search term to find text in open files</div>
              )}
              {term && textResults.length === 0 && (
                <div className="cp-empty">No matches for "{term}" in open files</div>
              )}
              {textResults.map((r, i) => (
                <div
                  key={`${r.tabId}-${r.lineNumber}`}
                  className={`cp-item ${i === selected ? "cp-selected" : ""}`}
                  onClick={() => runTextResult(r)}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span className="cp-file-icon">{getFileIcon(r.fileName)}</span>
                  <span className="cp-item-label">{r.lineContent || <em style={{ opacity: 0.5 }}>empty line</em>}</span>
                  <span className="cp-file-dir">{r.fileName}:{r.lineNumber}</span>
                </div>
              ))}
            </>
          )}

          {/* ── Language picker mode (lang:) ── */}
          {!showModes && mode === "lang" && (
            <>
              {!activeTab && (
                <div className="cp-empty">No file open — open a file to change its language</div>
              )}
              {activeTab && filteredLanguages.length === 0 && (
                <div className="cp-empty">No languages match "{term}"</div>
              )}
              {activeTab && filteredLanguages.map((l, i) => (
                <div
                  key={l.id}
                  className={`cp-item ${i === selected ? "cp-selected" : ""}`}
                  onClick={() => runLanguage(l)}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span className="cp-item-label">{l.name}</span>
                  <span className="cp-file-dir">{l.id}</span>
                  {activeTab?.language === l.id && <span className="cp-badge">current</span>}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
