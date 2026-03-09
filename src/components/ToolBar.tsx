import * as monaco from "monaco-editor";
import {
  FilePlus, FolderOpen, Save, SaveAll, XCircle,
  Undo2, Redo2,
  Braces, Hash, ChevronsDownUp, ChevronsUpDown, Terminal,
  Search, Replace,
  WrapText, Map, Palette,
  AArrowDown, AArrowUp,
  CopyPlus, Trash2, MoveUp, MoveDown, Combine,
  ArrowUpAZ, ArrowDownAZ,
  CaseUpper, CaseLower, CaseSensitive,
  Indent, Outdent, Eraser, TextSelect,
  Settings2,
  CircleSlash2,
} from "lucide-react";
import { useEditor } from "../store/editorStore";
import {
  newFile,
  openFile,
  saveFile,
  saveFileAs,
  closeTab,
} from "../commands/fileOps";
import { cycleTheme } from "../commands/theme";
import { saveSetting } from "../commands/settingsService";

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

// ─── Platform-aware shortcut labels ──────────────────────────────────────────

const isMac = navigator.userAgent.includes("Macintosh");

/** Returns `mac` on macOS, `win` on Windows/Linux */
const sc = (mac: string, win: string) => (isMac ? mac : win);


const IC = 18; // icon size for all toolbar icons

export default function ToolBar() {
  const { state, dispatch } = useEditor();

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null;
  const hasTab = !!activeTab;
  const isDirty = activeTab?.isDirty ?? false;

  // File ops
  const handleNew   = () => newFile(dispatch);
  const handleOpen  = () => openFile(dispatch);
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

  // Editor command palette (Monaco built-in ⇧⌘P)
  const handleEditorCommands = () => getEditor()?.trigger("", "editor.action.quickCommand", null);

  // Line operations
  const handleDuplicateDown  = () => getEditor()?.getAction("editor.action.copyLinesDownAction")?.run();
  const handleDeleteLine     = () => getEditor()?.getAction("editor.action.deleteLines")?.run();
  const handleMoveLinesUp    = () => getEditor()?.getAction("editor.action.moveLinesUpAction")?.run();
  const handleMoveLinesDown  = () => getEditor()?.getAction("editor.action.moveLinesDownAction")?.run();
  const handleJoinLines      = () => getEditor()?.getAction("editor.action.joinLines")?.run();
  const handleSortAsc        = () => getEditor()?.getAction("editor.action.sortLinesAscending")?.run();
  const handleSortDesc       = () => getEditor()?.getAction("editor.action.sortLinesDescending")?.run();

  // Transform
  const handleUpperCase  = () => getEditor()?.getAction("editor.action.transformToUppercase")?.run();
  const handleLowerCase  = () => getEditor()?.getAction("editor.action.transformToLowercase")?.run();
  const handleTitleCase  = () => getEditor()?.getAction("editor.action.transformToTitlecase")?.run();

  // Indent & Clean
  const handleIndent     = () => getEditor()?.getAction("editor.action.indentLines")?.run();
  const handleOutdent    = () => getEditor()?.getAction("editor.action.outdentLines")?.run();
  const handleTrimWS     = () => getEditor()?.getAction("editor.action.trimTrailingWhitespace")?.run();
  const handleSelectLine = () => getEditor()?.getAction("expandLineSelection")?.run();

  // Settings panel
  const handleSettings = () => {
    dispatch({ type: state.isSettingsOpen ? "CLOSE_SETTINGS" : "OPEN_SETTINGS" });
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Editor toolbar">

      {/* ── Group 1: File ── */}
      <div className="tb-group">
        <IconBtn label={`New File  ${sc("⌘N", "Ctrl+N")}`} onClick={handleNew}><FilePlus size={IC} /></IconBtn>
        <IconBtn label={`Open File  ${sc("⌘O", "Ctrl+O")}`} onClick={handleOpen}><FolderOpen size={IC} /></IconBtn>
        <IconBtn label={`Save${isDirty ? " ●" : ""}  ${sc("⌘S", "Ctrl+S")}`} onClick={handleSave} disabled={!hasTab}><Save size={IC} /></IconBtn>
        <IconBtn label={`Save As…  ${sc("⇧⌘S", "Ctrl+Shift+S")}`} onClick={handleSaveAs} disabled={!hasTab}><SaveAll size={IC} /></IconBtn>
        <IconBtn label={`Close Editor  ${sc("⌘W", "Ctrl+W")}`} onClick={handleClose} disabled={!hasTab}><XCircle size={IC} /></IconBtn>
      </div>

      <Sep />

      {/* ── Group 2: Edit ── */}
      <div className="tb-group">
        <IconBtn label={`Undo  ${sc("⌘Z", "Ctrl+Z")}`} onClick={handleUndo} disabled={!hasTab}><Undo2 size={IC} /></IconBtn>
        <IconBtn label={`Redo  ${sc("⇧⌘Z", "Ctrl+Y")}`} onClick={handleRedo} disabled={!hasTab}><Redo2 size={IC} /></IconBtn>
      </div>

      <Sep />

      {/* ── Group 3: Code ── */}
      <div className="tb-group">
        <IconBtn label={`Format Document  ${sc("⇧⌥F", "Shift+Alt+F")}`} onClick={handleFormat} disabled={!hasTab}><Braces size={IC} /></IconBtn>
        <IconBtn label={`Toggle Line Comment  ${sc("⌘/", "Ctrl+/")}`} onClick={handleComment} disabled={!hasTab}><Hash size={IC} /></IconBtn>
        <IconBtn label={`Fold All  ${sc("⌘K ⌘0", "Ctrl+K Ctrl+0")}`} onClick={handleFold} disabled={!hasTab}><ChevronsDownUp size={IC} /></IconBtn>
        <IconBtn label={`Unfold All  ${sc("⌘K ⌘J", "Ctrl+K Ctrl+J")}`} onClick={handleUnfold} disabled={!hasTab}><ChevronsUpDown size={IC} /></IconBtn>
        <IconBtn label={`Editor Commands  ${sc("⇧⌘P", "Ctrl+Shift+P")}`} onClick={handleEditorCommands} disabled={!hasTab}><Terminal size={IC} /></IconBtn>
      </div>

      <Sep />

      {/* ── Group 4: Search ── */}
      <div className="tb-group">
        <IconBtn label={`Find  ${sc("⌘F", "Ctrl+F")}`} onClick={handleFind} disabled={!hasTab}><Search size={IC} /></IconBtn>
        <IconBtn label={`Find & Replace  ${sc("⌥⌘F", "Ctrl+H")}`} onClick={handleReplace} disabled={!hasTab}><Replace size={IC} /></IconBtn>
      </div>

      <Sep />

      {/* ── Group 5: View toggles ── */}
      <div className="tb-group">
        <IconBtn label={`Word Wrap: ${state.wordWrap === "on" ? "On" : "Off"}  ${sc("⌥Z", "Alt+Z")}`} onClick={handleWordWrap} active={state.wordWrap === "on"}><WrapText size={IC} /></IconBtn>
        <IconBtn label={`Minimap: ${state.minimap ? "On" : "Off"}`} onClick={handleMinimap} active={state.minimap}><Map size={IC} /></IconBtn>
        <IconBtn label={`Diagnostics: ${state.diagnostics ? "On" : "Off"}`} onClick={() => { dispatch({ type: "SET_DIAGNOSTICS", diagnostics: !state.diagnostics }); saveSetting("diagnostics", !state.diagnostics); }} active={!state.diagnostics}><CircleSlash2 size={IC} /></IconBtn>
        <IconBtn label={`Theme: ${state.theme}`} onClick={handleTheme}><Palette size={IC} /></IconBtn>
      </div>

      <Sep />

      {/* ── Group 6: Font size ── */}
      <div className="tb-group tb-font-group">
        <IconBtn label={`Decrease Font Size  ${sc("⌘−", "Ctrl+−")}`} onClick={handleFontDec}><AArrowDown size={IC} /></IconBtn>
        <span className="tb-font-size" title="Current font size">{state.fontSize}</span>
        <IconBtn label={`Increase Font Size  ${sc("⌘=", "Ctrl+=")}`} onClick={handleFontInc}><AArrowUp size={IC} /></IconBtn>
      </div>

      <Sep />

      {/* ── Group 7: Line Operations ── */}
      <div className="tb-group">
        <IconBtn label={`Duplicate Line Down  ${sc("⇧⌥↓", "Shift+Alt+↓")}`} onClick={handleDuplicateDown} disabled={!hasTab}><CopyPlus size={IC} /></IconBtn>
        <IconBtn label={`Delete Line  ${sc("⇧⌘K", "Ctrl+Shift+K")}`} onClick={handleDeleteLine} disabled={!hasTab}><Trash2 size={IC} /></IconBtn>
        <IconBtn label={`Move Line Up  ${sc("⌥↑", "Alt+↑")}`} onClick={handleMoveLinesUp} disabled={!hasTab}><MoveUp size={IC} /></IconBtn>
        <IconBtn label={`Move Line Down  ${sc("⌥↓", "Alt+↓")}`} onClick={handleMoveLinesDown} disabled={!hasTab}><MoveDown size={IC} /></IconBtn>
        <IconBtn label="Join Lines" onClick={handleJoinLines} disabled={!hasTab}><Combine size={IC} /></IconBtn>
        <IconBtn label="Sort Lines Ascending" onClick={handleSortAsc} disabled={!hasTab}><ArrowUpAZ size={IC} /></IconBtn>
        <IconBtn label="Sort Lines Descending" onClick={handleSortDesc} disabled={!hasTab}><ArrowDownAZ size={IC} /></IconBtn>
      </div>

      <Sep />

      {/* ── Group 8: Transform ── */}
      <div className="tb-group">
        <IconBtn label="Transform to UPPERCASE" onClick={handleUpperCase} disabled={!hasTab}><CaseUpper size={IC} /></IconBtn>
        <IconBtn label="Transform to lowercase" onClick={handleLowerCase} disabled={!hasTab}><CaseLower size={IC} /></IconBtn>
        <IconBtn label="Transform to Title Case" onClick={handleTitleCase} disabled={!hasTab}><CaseSensitive size={IC} /></IconBtn>
      </div>

      <Sep />

      {/* ── Group 9: Indent & Clean ── */}
      <div className="tb-group">
        <IconBtn label={`Indent Lines  ${sc("⌘]", "Ctrl+]")}`} onClick={handleIndent} disabled={!hasTab}><Indent size={IC} /></IconBtn>
        <IconBtn label={`Outdent Lines  ${sc("⌘[", "Ctrl+[")}`} onClick={handleOutdent} disabled={!hasTab}><Outdent size={IC} /></IconBtn>
        <IconBtn label="Trim Trailing Whitespace" onClick={handleTrimWS} disabled={!hasTab}><Eraser size={IC} /></IconBtn>
        <IconBtn label={`Select Line  ${sc("⌘L", "Ctrl+L")}`} onClick={handleSelectLine} disabled={!hasTab}><TextSelect size={IC} /></IconBtn>
      </div>

      {/* ── Dirty indicator ─────── right-aligned ── */}
      {isDirty && (
        <span className="tb-dirty-pill" title="Unsaved changes">
          <span className="tb-dirty-dot" />
          unsaved
        </span>
      )}

      {/* ── Settings ─────────────────────────── far right ── */}
      <div className="tb-group tb-settings-group">
        <IconBtn
          label={`Settings  ${sc("⌘,", "Ctrl+,")}`}
          onClick={handleSettings}
          active={state.isSettingsOpen}
        >
          <Settings2 size={IC} />
        </IconBtn>
      </div>
    </div>
  );
}
