import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import * as monaco from "monaco-editor";
import { useEditor } from "../store/editorStore";
import { cycleTheme } from "../commands/theme";
import { saveSetting } from "../commands/settingsService";
import type { StatusInfo } from "../types";

const DEFAULT_TAB_SIZE = 2;
const DEFAULT_INSERT_SPACES = true;

export default function StatusBar() {
  const { state, dispatch } = useEditor();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [langFilter, setLangFilter] = useState("");
  const langInputRef = useRef<HTMLInputElement>(null);
  const langContainerRef = useRef<HTMLSpanElement>(null);

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null;

  const model = activeTab
    ? monaco.editor.getModel(monaco.Uri.parse(activeTab.modelUri))
    : null;
  const modelOptions = model?.getOptions();
  const tabSize = modelOptions?.tabSize ?? DEFAULT_TAB_SIZE;
  const insertSpaces = modelOptions?.insertSpaces ?? DEFAULT_INSERT_SPACES;
  const indentation = insertSpaces ? `Spaces: ${tabSize}` : `Tab Size: ${tabSize}`;
  const eolSeq = model?.getEOL();
  const eol = eolSeq === "\r\n" ? "CRLF" : eolSeq === "\r" ? "CR" : "LF";

  const info: StatusInfo = {
    language: activeTab?.language ?? "plaintext",
    lineNumber: activeTab?.cursorPosition?.lineNumber ?? 1,
    column: activeTab?.cursorPosition?.column ?? 1,
    encoding: "UTF-8",
    eol,
    indentation,
  };

  // ── Language picker ────────────────────────────────────────────────────────
  const allLanguages = useMemo(() => {
    return monaco.languages
      .getLanguages()
      .map((l) => ({ id: l.id, name: (l.aliases ?? [])[0] ?? l.id }))
      .filter((l) => l.id !== "")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredLangs = useMemo(() => {
    if (!langFilter) return allLanguages;
    const lower = langFilter.toLowerCase();
    return allLanguages
      .filter((l) => l.id.toLowerCase().includes(lower) || l.name.toLowerCase().includes(lower));
  }, [allLanguages, langFilter]);

  const openLangPicker = useCallback(() => {
    setLangFilter("");
    setShowLangPicker(true);
  }, []);

  const closeLangPicker = useCallback(() => setShowLangPicker(false), []);

  const selectLang = useCallback(
    (langId: string) => {
      if (!activeTab) return;
      const m = monaco.editor.getModel(monaco.Uri.parse(activeTab.modelUri));
      if (m) {
        monaco.editor.setModelLanguage(m, langId);
        dispatch({ type: "SET_LANGUAGE", tabId: activeTab.id, language: langId });
      }
      setShowLangPicker(false);
    },
    [activeTab, dispatch]
  );

  // Focus input when picker opens
  useEffect(() => {
    if (showLangPicker) {
      setTimeout(() => langInputRef.current?.focus(), 30);
    }
  }, [showLangPicker]);

  // Close on outside click
  useEffect(() => {
    if (!showLangPicker) return;
    const handler = (e: MouseEvent) => {
      if (langContainerRef.current && !langContainerRef.current.contains(e.target as Node)) {
        setShowLangPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLangPicker]);

  // ── EOL toggle ─────────────────────────────────────────────────────────────
  const handleEolToggle = useCallback(() => {
    if (!model || eol === "CR") return;
    const next =
      eol === "LF"
        ? monaco.editor.EndOfLineSequence.CRLF
        : monaco.editor.EndOfLineSequence.LF;
    model.pushEOL(next);
  }, [model, eol]);

  // ── Other toggles ──────────────────────────────────────────────────────────
  const handleThemeClick = useCallback(() => {
    cycleTheme(state.theme, dispatch);
  }, [state.theme, dispatch]);

  const handleWordWrapToggle = useCallback(() => {
    const next = state.wordWrap === "on" ? "off" : "on";
    dispatch({ type: "SET_WORD_WRAP", wordWrap: next as "on" | "off" });
    saveSetting("wordWrap", next);
  }, [state.wordWrap, dispatch]);

  const handleMinimapToggle = useCallback(() => {
    dispatch({ type: "SET_MINIMAP", minimap: !state.minimap });
    saveSetting("minimap", !state.minimap);
  }, [state.minimap, dispatch]);

  return (
    <div className="status-bar">
      <div className="status-left">
        {activeTab && (
          <>
            <span className="status-item">
              Ln {info.lineNumber}, Col {info.column}
            </span>
            <span className="status-item">{info.indentation}</span>
            <span className="status-item">{info.encoding}</span>
            {eol !== "CR" ? (
              <button
                className="status-item status-btn"
                onClick={handleEolToggle}
                title={`Line endings: ${eol} — click to toggle LF ↔ CRLF`}
              >
                {eol}
              </button>
            ) : (
              <span className="status-item">{eol}</span>
            )}
          </>
        )}
      </div>
      <div className="status-right">
        {activeTab && (
          <span
            ref={langContainerRef}
            className="status-item status-language"
            style={{ position: "relative" }}
          >
            <button
              className="status-btn"
              onClick={openLangPicker}
              title="Change language mode"
            >
              {info.language}
            </button>
            {showLangPicker && (
              <div className="sb-lang-picker">
                <input
                  ref={langInputRef}
                  className="sb-lang-input"
                  type="text"
                  placeholder="Filter languages…"
                  value={langFilter}
                  onChange={(e) => setLangFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") closeLangPicker();
                    if (e.key === "Enter" && filteredLangs[0]) selectLang(filteredLangs[0].id);
                  }}
                />
                <div className="sb-lang-list">
                  {filteredLangs.map((l) => (
                    <div
                      key={l.id}
                      className={`sb-lang-item${activeTab?.language === l.id ? " sb-lang-current" : ""}`}
                      onClick={() => selectLang(l.id)}
                    >
                      <span>{l.name}</span>
                      {activeTab?.language === l.id && (
                        <span className="sb-lang-check">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </span>
        )}
        <button
          className="status-item status-btn"
          onClick={handleWordWrapToggle}
          title="Toggle word wrap"
        >
          Wrap: {state.wordWrap === "on" ? "On" : "Off"}
        </button>
        <button
          className="status-item status-btn"
          onClick={handleMinimapToggle}
          title="Toggle minimap"
        >
          Minimap: {state.minimap ? "On" : "Off"}
        </button>
        <button
          className="status-item status-btn"
          onClick={handleThemeClick}
          title="Cycle theme"
        >
          {state.theme === "vs-dark"
            ? "Dark"
            : state.theme === "vs"
            ? "Light"
            : "HC"}
        </button>
      </div>
    </div>
  );
}
