import { useCallback } from "react";
import * as monaco from "monaco-editor";
import { useEditor } from "../store/editorStore";
import {
  newFile,
  openFile,
  saveFile,
  saveFileAs,
  closeTab,
} from "../commands/fileOps";
import { cycleTheme, saveSetting } from "../commands/theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEditor(): monaco.editor.IStandaloneCodeEditor | null {
  const editors = monaco.editor.getEditors();
  return editors.length > 0 ? (editors[0] as monaco.editor.IStandaloneCodeEditor) : null;
}

// ─── Icon Button ─────────────────────────────────────────────────────────────

interface IconButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}

function IconBtn({ label, onClick, disabled = false, active = false, children }: IconButtonProps) {
  return (
    <button
      className={`tb-btn${active ? " tb-active" : ""}${disabled ? " tb-disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      title={label}
      aria-label={label}
      type="button"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="tb-sep" aria-hidden="true" />;
}

// ─── SVG icon library ─────────────────────────────────────────────────────────

const Icons = {
  newFile: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M9.5 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5.5L9.5 1zM9 2.5V5h2.5l.5.5V13H3V2h6v.5zM8 7H7v1.5H5.5v1H7V11h1V9.5h1.5v-1H8V7z"/>
    </svg>
  ),
  openFile: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M14.5 3H7.707l-2-2H1.5A1.5 1.5 0 0 0 0 2.5v11A1.5 1.5 0 0 0 1.5 15h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 3zM15 13.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H5.293l2 2H14.5a.5.5 0 0 1 .5.5z"/>
    </svg>
  ),
  save: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.353 1.146l1.5 1.5L15 3v10.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11A1.5 1.5 0 0 1 2.5 1H13l.353.146zM2 2.5v11a.5.5 0 0 0 .5.5H4v-4.5A1.5 1.5 0 0 1 5.5 8h5A1.5 1.5 0 0 1 12 9.5V14h1.5a.5.5 0 0 0 .5-.5V3.707L12.293 2H11v2.5A1.5 1.5 0 0 1 9.5 6h-3A1.5 1.5 0 0 1 5 4.5V2H2.5a.5.5 0 0 0-.5.5zM9 2v2.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V2h2zm2 12V9.5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5V14h6z"/>
    </svg>
  ),
  saveAs: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.353 1.146l1.5 1.5L15 3v10.5a1.5 1.5 0 0 1-1.5 1.5H11v-1h2.5a.5.5 0 0 0 .5-.5V3.707L12.293 2H11v2.5A1.5 1.5 0 0 1 9.5 6h-3A1.5 1.5 0 0 1 5 4.5V2H2.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5H5v1H2.5A1.5 1.5 0 0 1 1 13.5v-11A1.5 1.5 0 0 1 2.5 1H13l.353.146zM9 2v2.5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5V2h2zM7.5 9a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm4.354.146l.707.707-1.853 1.854-.707-.707.707-.707H9v-1h1.708l.146-.147z"/>
    </svg>
  ),
  closeTab: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm-2.646 3.646L8 8.293l2.646-2.647.708.708L8.707 9l2.647 2.646-.708.708L8 9.707l-2.646 2.647-.708-.708L7.293 9 4.646 6.354l.708-.708z"/>
    </svg>
  ),
  undo: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 5h8a3 3 0 0 1 0 6H6.5v-1H12a2 2 0 1 0 0-4H4.5l2 2-1 1-3-3 3-3 1 1L4.5 5H4z"/>
    </svg>
  ),
  redo: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M12 5H4.5l-2-2 1-1 3 3-3 3-1-1 2-2H4a2 2 0 1 0 0 4h5.5v1H4a3 3 0 0 1 0-6h8l-.5-.5 1-1 1 1V9H12V5z"/>
      <path d="M11.5 7l-1-1 3-3 1 1-3 3z"/>
    </svg>
  ),
  format: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3h12v1H2V3zm0 3h8v1H2V6zm0 3h10v1H2V9zm0 3h6v1H2v-1zm10.5-4.5 3 3-3 3-.707-.707 2.293-2.293-2.293-2.293.707-.707z"/>
    </svg>
  ),
  comment: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 2h12v1H2V2zm0 3h8v1H2V5zm0 3h12v1H2V8zm0 3h8v1H2v-1z"/>
      <path d="M12.5 7a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5H11l-1 1.5-1-1.5H8.5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5h4zm-4 1v3h1.29l.71 1.06.71-1.06H12V8H8.5z"/>
    </svg>
  ),
  foldAll: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 5.5 4 2l1-1 3 3 3-3 1 1L8 5.5zm0 5 4 3.5-1 1-3-3-3 3-1-1L8 10.5z"/>
      <path d="M2 7h12v2H2V7z"/>
    </svg>
  ),
  unfoldAll: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2.5 4 6l1 1 3-3 3 3 1-1L8 2.5zm0 11-4-3.5 1-1 3 3 3-3 1 1L8 13.5z"/>
      <path d="M2 7h12v2H2V7z"/>
    </svg>
  ),
  find: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.5 1a5.5 5.5 0 1 0 3.613 9.72l3.082 3.083.707-.708-3.082-3.082A5.5 5.5 0 0 0 6.5 1zm-4.5 5.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0z"/>
    </svg>
  ),
  replace: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.5 1a4.5 4.5 0 1 0 2.957 7.957l2.836 2.836.707-.707-2.836-2.836A4.5 4.5 0 0 0 5.5 1zM2 5.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
      <path d="M10 9.5V12h1.5l-2 2.5-2-2.5H9V9.5h1z"/>
    </svg>
  ),
  wordWrap: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3h12v1H2V3zm0 3h9.5a2.5 2.5 0 0 1 0 5H10v1.5l-2-2 2-2V9h1.5a1.5 1.5 0 0 0 0-3H2V6zm0 6h4v1H2v-1z"/>
    </svg>
  ),
  minimap: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="4" height="14" rx="0.5"/>
      <rect x="7" y="1" width="2" height="14" rx="0.5" opacity="0.6"/>
      <rect x="11" y="1" width="1.5" height="14" rx="0.5" opacity="0.4"/>
      <rect x="13.5" y="1" width="1.5" height="14" rx="0.5" opacity="0.25"/>
    </svg>
  ),
  fontSmaller: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.5 2 1 13h1.5l1.25-3.5h4.5L9.5 13H11L6.5 2h-1zm.5 1.5 1.9 5.1H4.1L6 3.5z"/>
      <path d="M12 8v4h1V8h2V7h-2V5h-1v2h-2v1h2z" transform="rotate(45, 12, 10.5) scale(0.8) translate(2,2)"/>
      <path d="M10 11h4v1h-4v-1z"/>
    </svg>
  ),
  fontLarger: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2 0 13h1.2L2.2 9.5h3.6L6.8 13H8L4 2zm.5 1.5 1.5 4.5h-3L4.5 3.5z"/>
      <path d="M11 3v2.5H8.5v1H11V9h1V6.5h2.5v-1H12V3h-1z"/>
    </svg>
  ),
  theme: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1v12A6 6 0 0 1 8 2z"/>
    </svg>
  ),
} as const;

// ─── ToolBar Component ────────────────────────────────────────────────────────

export default function ToolBar() {
  const { state, dispatch } = useEditor();

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null;
  const hasTab = !!activeTab;
  const isDirty = activeTab?.isDirty ?? false;

  const run = useCallback((fn: () => void) => {
    fn();
  }, []);

  // File ops
  const handleNew   = () => run(() => newFile(dispatch));
  const handleOpen  = () => run(() => openFile(dispatch));
  const handleSave  = () => {
    if (!activeTab) return;
    activeTab.filePath ? saveFile(activeTab, dispatch) : saveFileAs(activeTab, dispatch);
  };
  const handleSaveAs = () => { if (activeTab) saveFileAs(activeTab, dispatch); };
  const handleClose  = () => { if (activeTab) closeTab(activeTab, dispatch); };

  // Edit ops — delegate to Monaco
  const handleUndo   = () => getEditor()?.trigger("toolbar", "undo", null);
  const handleRedo   = () => getEditor()?.trigger("toolbar", "redo", null);

  // Code ops
  const handleFormat  = () => getEditor()?.getAction("editor.action.formatDocument")?.run();
  const handleComment = () => getEditor()?.getAction("editor.action.commentLine")?.run();
  const handleFold    = () => getEditor()?.getAction("editor.foldAll")?.run();
  const handleUnfold  = () => getEditor()?.getAction("editor.unfoldAll")?.run();

  // Find
  const handleFind    = () => getEditor()?.getAction("actions.find")?.run();
  const handleReplace = () => getEditor()?.getAction("editor.action.startFindReplaceAction")?.run();

  // View toggles
  const handleWordWrap = () => {
    const next = state.wordWrap === "on" ? "off" : "on";
    dispatch({ type: "SET_WORD_WRAP", wordWrap: next as "on" | "off" });
    saveSetting("wordWrap", next);
  };
  const handleMinimap = () => {
    dispatch({ type: "SET_MINIMAP", minimap: !state.minimap });
    saveSetting("minimap", !state.minimap);
  };
  const handleTheme = () => cycleTheme(state.theme, dispatch);

  // Font
  const handleFontDec = () => {
    const next = Math.max(state.fontSize - 1, 8);
    dispatch({ type: "SET_FONT_SIZE", fontSize: next });
    saveSetting("fontSize", next);
  };
  const handleFontInc = () => {
    const next = Math.min(state.fontSize + 1, 40);
    dispatch({ type: "SET_FONT_SIZE", fontSize: next });
    saveSetting("fontSize", next);
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Editor toolbar">

      {/* ── Group 1: File ── */}
      <div className="tb-group">
        <IconBtn label="New File (⌘N)" onClick={handleNew}>{Icons.newFile}</IconBtn>
        <IconBtn label="Open File (⌘O)" onClick={handleOpen}>{Icons.openFile}</IconBtn>
        <IconBtn label={`Save${isDirty ? " ●" : ""} (⌘S)`} onClick={handleSave} disabled={!hasTab}>{Icons.save}</IconBtn>
        <IconBtn label="Save As… (⇧⌘S)" onClick={handleSaveAs} disabled={!hasTab}>{Icons.saveAs}</IconBtn>
        <IconBtn label="Close Editor (⌘W)" onClick={handleClose} disabled={!hasTab}>{Icons.closeTab}</IconBtn>
      </div>

      <Sep />

      {/* ── Group 2: Edit ── */}
      <div className="tb-group">
        <IconBtn label="Undo (⌘Z)" onClick={handleUndo} disabled={!hasTab}>{Icons.undo}</IconBtn>
        <IconBtn label="Redo (⇧⌘Z)" onClick={handleRedo} disabled={!hasTab}>{Icons.redo}</IconBtn>
      </div>

      <Sep />

      {/* ── Group 3: Code ── */}
      <div className="tb-group">
        <IconBtn label="Format Document (⇧⌥F)" onClick={handleFormat} disabled={!hasTab}>{Icons.format}</IconBtn>
        <IconBtn label="Toggle Line Comment (⌘/)" onClick={handleComment} disabled={!hasTab}>{Icons.comment}</IconBtn>
        <IconBtn label="Fold All" onClick={handleFold} disabled={!hasTab}>{Icons.foldAll}</IconBtn>
        <IconBtn label="Unfold All" onClick={handleUnfold} disabled={!hasTab}>{Icons.unfoldAll}</IconBtn>
      </div>

      <Sep />

      {/* ── Group 4: Search ── */}
      <div className="tb-group">
        <IconBtn label="Find (⌘F)" onClick={handleFind} disabled={!hasTab}>{Icons.find}</IconBtn>
        <IconBtn label="Find & Replace (⌘H)" onClick={handleReplace} disabled={!hasTab}>{Icons.replace}</IconBtn>
      </div>

      <Sep />

      {/* ── Group 5: View toggles ── */}
      <div className="tb-group">
        <IconBtn label={`Word Wrap: ${state.wordWrap === "on" ? "On" : "Off"}`} onClick={handleWordWrap} active={state.wordWrap === "on"}>{Icons.wordWrap}</IconBtn>
        <IconBtn label={`Minimap: ${state.minimap ? "On" : "Off"}`} onClick={handleMinimap} active={state.minimap}>{Icons.minimap}</IconBtn>
        <IconBtn label={`Theme: ${state.theme}`} onClick={handleTheme}>{Icons.theme}</IconBtn>
      </div>

      <Sep />

      {/* ── Group 6: Font size ── */}
      <div className="tb-group tb-font-group">
        <IconBtn label="Decrease Font Size (⌘-)" onClick={handleFontDec}>{Icons.fontSmaller}</IconBtn>
        <span className="tb-font-size" title="Current font size">{state.fontSize}</span>
        <IconBtn label="Increase Font Size (⌘=)" onClick={handleFontInc}>{Icons.fontLarger}</IconBtn>
      </div>

      {/* ── Dirty indicator ─────── right-aligned ── */}
      {isDirty && (
        <span className="tb-dirty-pill" title="Unsaved changes">
          <span className="tb-dirty-dot" />
          unsaved
        </span>
      )}
    </div>
  );
}
