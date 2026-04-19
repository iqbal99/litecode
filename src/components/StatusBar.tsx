import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import * as monaco from "monaco-editor";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import { setLanguage, setWordWrap, setMinimap } from "../store/editorSlice";
import { cycleTheme } from "../commands/theme";
import type { StatusInfo } from "../types";

const DEFAULT_TAB_SIZE = 2;
const DEFAULT_INSERT_SPACES = true;

export default function StatusBar() {
  const tabs = useAppSelector((s) => s.editor.tabs);
  const activeTabId = useAppSelector((s) => s.editor.activeTabId);
  const wordWrap = useAppSelector((s) => s.editor.wordWrap);
  const minimapEnabled = useAppSelector((s) => s.editor.minimap);
  const theme = useAppSelector((s) => s.editor.theme);
  const dispatch = useAppDispatch();

  const [showLangPicker, setShowLangPicker] = useState(false);
  const [langFilter, setLangFilter] = useState("");
  const langInputRef = useRef<HTMLInputElement>(null);
  const langContainerRef = useRef<HTMLSpanElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const isSettingsTab = activeTab?.isSettings === true;

  const model =
    activeTab && !isSettingsTab && activeTab.modelUri
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

  const [langHighlight, setLangHighlight] = useState(-1);

  const openLangPicker = useCallback(() => {
    setLangFilter("");
    setLangHighlight(-1);
    setShowLangPicker(true);
  }, []);

  const closeLangPicker = useCallback(() => setShowLangPicker(false), []);

  const langListRef = useRef<HTMLDivElement>(null);
  const langButtonRef = useRef<HTMLButtonElement>(null);

  const selectLang = useCallback(
    (langId: string) => {
      if (!activeTab || !activeTab.modelUri) return;
      const m = monaco.editor.getModel(monaco.Uri.parse(activeTab.modelUri));
      if (m) {
        monaco.editor.setModelLanguage(m, langId);
        dispatch(setLanguage({ tabId: activeTab.id, language: langId }));
      }
      setShowLangPicker(false);
    },
    [activeTab, dispatch]
  );

  useEffect(() => {
    if (showLangPicker) {
      setTimeout(() => langInputRef.current?.focus(), 30);
    }
  }, [showLangPicker]);

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

  useEffect(() => {
    if (!showLangPicker || langHighlight < 0) return;
    const list = langListRef.current;
    if (!list) return;
    const item = list.children[langHighlight] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [langHighlight, showLangPicker, filteredLangs.length]);

  useEffect(() => {
    // Keep the highlight in range when the list shrinks.
    if (langHighlight >= filteredLangs.length) {
      setLangHighlight(filteredLangs.length > 0 ? filteredLangs.length - 1 : -1);
    }
  }, [filteredLangs.length, langHighlight]);

  const handleEolToggle = useCallback(() => {
    if (!model || eol === "CR") return;
    const next =
      eol === "LF"
        ? monaco.editor.EndOfLineSequence.CRLF
        : monaco.editor.EndOfLineSequence.LF;
    model.pushEOL(next);
  }, [model, eol]);

  const handleThemeClick = useCallback(() => {
    cycleTheme(theme, dispatch);
  }, [theme, dispatch]);

  const handleWordWrapToggle = useCallback(() => {
    const next = wordWrap === "on" ? "off" : "on";
    dispatch(setWordWrap(next as "on" | "off"));
  }, [wordWrap, dispatch]);

  const handleMinimapToggle = useCallback(() => {
    dispatch(setMinimap(!minimapEnabled));
  }, [minimapEnabled, dispatch]);

  return (
    <div className="status-bar">
      <div className="status-left">
        {activeTab && !isSettingsTab && (
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
        {activeTab && !isSettingsTab && (
          <span
            ref={langContainerRef}
            className="status-item status-language"
            style={{ position: "relative" }}
          >
            <button
              ref={langButtonRef}
              className="status-btn"
              onClick={openLangPicker}
              title="Change language mode"
              aria-haspopup="listbox"
              aria-expanded={showLangPicker}
            >
              {info.language}
            </button>
            {showLangPicker && (
              <div className="sb-lang-picker" role="dialog" aria-label="Select language mode">
                <input
                  ref={langInputRef}
                  className="sb-lang-input"
                  type="text"
                  placeholder="Filter languages…"
                  value={langFilter}
                  role="combobox"
                  aria-controls="sb-lang-listbox"
                  aria-expanded={showLangPicker}
                  aria-autocomplete="list"
                  onChange={(e) => { setLangFilter(e.target.value); setLangHighlight(0); }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      closeLangPicker();
                      langButtonRef.current?.focus();
                      return;
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setLangHighlight((h) => Math.min(h + 1, filteredLangs.length - 1));
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setLangHighlight((h) => Math.max(h - 1, 0));
                      return;
                    }
                    if (e.key === "Enter") {
                      const target = filteredLangs[langHighlight >= 0 ? langHighlight : 0];
                      if (target) selectLang(target.id);
                    }
                  }}
                />
                <div
                  id="sb-lang-listbox"
                  role="listbox"
                  className="sb-lang-list"
                  ref={langListRef}
                >
                  {filteredLangs.map((l, i) => (
                    <div
                      key={l.id}
                      role="option"
                      aria-selected={i === langHighlight}
                      className={`sb-lang-item${activeTab?.language === l.id ? " sb-lang-current" : ""}${i === langHighlight ? " sb-lang-highlighted" : ""}`}
                      onClick={() => selectLang(l.id)}
                      onMouseEnter={() => setLangHighlight(i)}
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
          Wrap: {wordWrap === "on" ? "On" : "Off"}
        </button>
        <button
          className="status-item status-btn"
          onClick={handleMinimapToggle}
          title="Toggle minimap"
        >
          Minimap: {minimapEnabled ? "On" : "Off"}
        </button>
        <button
          className="status-item status-btn"
          onClick={handleThemeClick}
          title="Cycle theme"
        >
          {theme === "vs-dark"
            ? "Dark"
            : theme === "vs"
            ? "Light"
            : "HC"}
        </button>
      </div>
    </div>
  );
}
