import {
  FilePlus, FolderOpen, Save, FilePenLine, XCircle,
  Undo2, Redo2,
  WandSparkles, MessageSquareCode, ChevronsDownUp, ChevronsUpDown, Command,
  Search, Replace,
  WrapText, Map, Palette,
  AArrowDown, AArrowUp,
  CopyPlus, Trash2, MoveUp, MoveDown, Combine,
  ArrowUpAZ, ArrowDownAZ,
  CaseUpper, CaseLower, CaseSensitive,
  Indent, Outdent, Eraser, TextSelect,
  Settings2,
  CircleAlert,
} from "lucide-react";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import { getEditorRef } from "../store/editorRef";
import {
  setWordWrap,
  setMinimap,
  setDiagnostics,
  setFontSize,
  openSettings,
  closeSettings,
} from "../store/editorSlice";
import {
  newFile,
  openFile,
  saveFile,
  saveFileAs,
  closeTab,
} from "../commands/fileOps";
import { cycleTheme } from "../commands/theme";
import { sc } from "../utils/platform";

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
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
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

const IC = 18;

export default function ToolBar() {
  const tabs = useAppSelector((s) => s.editor.tabs);
  const activeTabId = useAppSelector((s) => s.editor.activeTabId);
  const wordWrap = useAppSelector((s) => s.editor.wordWrap);
  const minimapEnabled = useAppSelector((s) => s.editor.minimap);
  const diagnosticsEnabled = useAppSelector((s) => s.editor.diagnostics);
  const theme = useAppSelector((s) => s.editor.theme);
  const fontSize = useAppSelector((s) => s.editor.fontSize);
  const isSettingsOpen = useAppSelector((s) => s.editor.isSettingsOpen);
  const dispatch = useAppDispatch();

  const getEditor = () => getEditorRef();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const hasEditorTab = tabs.some((t) => !t.isSettings) && !activeTab?.isSettings;
  const isDirty = activeTab?.isDirty ?? false;

  const handleNew   = () => newFile(dispatch);
  const handleOpen  = () => openFile(dispatch);
  const handleSave  = async () => {
    if (!activeTab) return;
    if (activeTab.filePath) {
      await saveFile(activeTab, dispatch);
    } else {
      await saveFileAs(activeTab, dispatch);
    }
  };
  const handleSaveAs = async () => {
    if (activeTab) {
      await saveFileAs(activeTab, dispatch);
    }
  };
  const handleClose  = async () => {
    if (!activeTab) return;
    if (activeTab.isSettings) {
      dispatch(closeSettings());
      return;
    }
    await closeTab(activeTab, dispatch);
  };

  const handleUndo   = () => getEditor()?.trigger("toolbar", "undo", null);
  const handleRedo   = () => getEditor()?.trigger("toolbar", "redo", null);

  const handleFormat  = () => getEditor()?.getAction("editor.action.formatDocument")?.run();
  const handleComment = () => getEditor()?.getAction("editor.action.commentLine")?.run();
  const handleFold    = () => getEditor()?.getAction("editor.foldAll")?.run();
  const handleUnfold  = () => getEditor()?.getAction("editor.unfoldAll")?.run();

  const handleFind    = () => getEditor()?.getAction("actions.find")?.run();
  const handleReplace = () => getEditor()?.getAction("editor.action.startFindReplaceAction")?.run();

  const handleWordWrap = () => {
    const next = wordWrap === "on" ? "off" : "on";
    dispatch(setWordWrap(next as "on" | "off"));
  };
  const handleMinimap = () => {
    dispatch(setMinimap(!minimapEnabled));
  };
  const handleTheme = () => cycleTheme(theme, dispatch);

  const handleFontDec = () => {
    dispatch(setFontSize(Math.max(fontSize - 1, 8)));
  };
  const handleFontInc = () => {
    dispatch(setFontSize(Math.min(fontSize + 1, 72)));
  };

  const handleEditorCommands = () => getEditor()?.trigger("", "editor.action.quickCommand", null);

  const handleDuplicateDown  = () => getEditor()?.getAction("editor.action.copyLinesDownAction")?.run();
  const handleDeleteLine     = () => getEditor()?.getAction("editor.action.deleteLines")?.run();
  const handleMoveLinesUp    = () => getEditor()?.getAction("editor.action.moveLinesUpAction")?.run();
  const handleMoveLinesDown  = () => getEditor()?.getAction("editor.action.moveLinesDownAction")?.run();
  const handleJoinLines      = () => getEditor()?.getAction("editor.action.joinLines")?.run();
  const handleSortAsc        = () => getEditor()?.getAction("editor.action.sortLinesAscending")?.run();
  const handleSortDesc       = () => getEditor()?.getAction("editor.action.sortLinesDescending")?.run();

  const handleUpperCase  = () => getEditor()?.getAction("editor.action.transformToUppercase")?.run();
  const handleLowerCase  = () => getEditor()?.getAction("editor.action.transformToLowercase")?.run();
  const handleTitleCase  = () => getEditor()?.getAction("editor.action.transformToTitlecase")?.run();

  const handleIndent     = () => getEditor()?.getAction("editor.action.indentLines")?.run();
  const handleOutdent    = () => getEditor()?.getAction("editor.action.outdentLines")?.run();
  const handleTrimWS     = () => getEditor()?.getAction("editor.action.trimTrailingWhitespace")?.run();
  const handleSelectLine = () => getEditor()?.getAction("expandLineSelection")?.run();

  const handleSettings = () => {
    dispatch(isSettingsOpen ? closeSettings() : openSettings());
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Editor toolbar">

      <div className="tb-group">
        <IconBtn label={`New File  ${sc("⌘N", "Ctrl+N")}`} onClick={handleNew}><FilePlus size={IC} /></IconBtn>
        <IconBtn label={`Open File  ${sc("⌘O", "Ctrl+O")}`} onClick={handleOpen}><FolderOpen size={IC} /></IconBtn>
        <IconBtn label={`Save${isDirty ? " ●" : ""}  ${sc("⌘S", "Ctrl+S")}`} onClick={handleSave} disabled={!hasEditorTab}><Save size={IC} /></IconBtn>
        <IconBtn label={`Save As…  ${sc("⇧⌘S", "Ctrl+Shift+S")}`} onClick={handleSaveAs} disabled={!hasEditorTab}><FilePenLine size={IC} /></IconBtn>
        <IconBtn label={`Close Editor  ${sc("⌘W", "Ctrl+W")}`} onClick={handleClose} disabled={!hasEditorTab}><XCircle size={IC} /></IconBtn>
      </div>

      <Sep />

      <div className="tb-group">
        <IconBtn label={`Undo  ${sc("⌘Z", "Ctrl+Z")}`} onClick={handleUndo} disabled={!hasEditorTab}><Undo2 size={IC} /></IconBtn>
        <IconBtn label={`Redo  ${sc("⇧⌘Z", "Ctrl+Y")}`} onClick={handleRedo} disabled={!hasEditorTab}><Redo2 size={IC} /></IconBtn>
      </div>

      <Sep />

      <div className="tb-group">
        <IconBtn label={`Format Document  ${sc("⇧⌥F", "Shift+Alt+F")}`} onClick={handleFormat} disabled={!hasEditorTab}><WandSparkles size={IC} /></IconBtn>
        <IconBtn label={`Toggle Line Comment  ${sc("⌘/", "Ctrl+/")}`} onClick={handleComment} disabled={!hasEditorTab}><MessageSquareCode size={IC} /></IconBtn>
        <IconBtn label={`Fold All  ${sc("⌘K ⌘0", "Ctrl+K Ctrl+0")}`} onClick={handleFold} disabled={!hasEditorTab}><ChevronsDownUp size={IC} /></IconBtn>
        <IconBtn label={`Unfold All  ${sc("⌘K ⌘J", "Ctrl+K Ctrl+J")}`} onClick={handleUnfold} disabled={!hasEditorTab}><ChevronsUpDown size={IC} /></IconBtn>
        <IconBtn label={`Editor Commands  ${sc("⇧⌘P", "Ctrl+Shift+P")}`} onClick={handleEditorCommands} disabled={!hasEditorTab}><Command size={IC} /></IconBtn>
      </div>

      <Sep />

      <div className="tb-group">
        <IconBtn label={`Find  ${sc("⌘F", "Ctrl+F")}`} onClick={handleFind} disabled={!hasEditorTab}><Search size={IC} /></IconBtn>
        <IconBtn label={`Find & Replace  ${sc("⌥⌘F", "Ctrl+H")}`} onClick={handleReplace} disabled={!hasEditorTab}><Replace size={IC} /></IconBtn>
      </div>

      <Sep />

      <div className="tb-group">
        <IconBtn label={`Word Wrap: ${wordWrap === "on" ? "On" : "Off"}  ${sc("⌥Z", "Alt+Z")}`} onClick={handleWordWrap} active={wordWrap === "on"}><WrapText size={IC} /></IconBtn>
        <IconBtn label={`Minimap: ${minimapEnabled ? "On" : "Off"}`} onClick={handleMinimap} active={minimapEnabled}><Map size={IC} /></IconBtn>
        <IconBtn label={`Diagnostics: ${diagnosticsEnabled ? "On" : "Off"}`} onClick={() => { dispatch(setDiagnostics(!diagnosticsEnabled)); }} active={diagnosticsEnabled}><CircleAlert size={IC} /></IconBtn>
        <IconBtn label={`Theme: ${theme}`} onClick={handleTheme}><Palette size={IC} /></IconBtn>
      </div>

      <Sep />

      <div className="tb-group tb-font-group">
        <IconBtn label={`Decrease Font Size  ${sc("⌘−", "Ctrl+−")}`} onClick={handleFontDec}><AArrowDown size={IC} /></IconBtn>
        <span className="tb-font-size" title="Current font size">{fontSize}</span>
        <IconBtn label={`Increase Font Size  ${sc("⌘=", "Ctrl+=")}`} onClick={handleFontInc}><AArrowUp size={IC} /></IconBtn>
      </div>

      <Sep />

      <div className="tb-group">
        <IconBtn label={`Duplicate Line Down  ${sc("⇧⌥↓", "Shift+Alt+↓")}`} onClick={handleDuplicateDown} disabled={!hasEditorTab}><CopyPlus size={IC} /></IconBtn>
        <IconBtn label={`Delete Line  ${sc("⇧⌘K", "Ctrl+Shift+K")}`} onClick={handleDeleteLine} disabled={!hasEditorTab}><Trash2 size={IC} /></IconBtn>
        <IconBtn label={`Move Line Up  ${sc("⌥↑", "Alt+↑")}`} onClick={handleMoveLinesUp} disabled={!hasEditorTab}><MoveUp size={IC} /></IconBtn>
        <IconBtn label={`Move Line Down  ${sc("⌥↓", "Alt+↓")}`} onClick={handleMoveLinesDown} disabled={!hasEditorTab}><MoveDown size={IC} /></IconBtn>
        <IconBtn label="Join Lines" onClick={handleJoinLines} disabled={!hasEditorTab}><Combine size={IC} /></IconBtn>
        <IconBtn label="Sort Lines Ascending" onClick={handleSortAsc} disabled={!hasEditorTab}><ArrowUpAZ size={IC} /></IconBtn>
        <IconBtn label="Sort Lines Descending" onClick={handleSortDesc} disabled={!hasEditorTab}><ArrowDownAZ size={IC} /></IconBtn>
      </div>

      <Sep />

      <div className="tb-group">
        <IconBtn label="Transform to UPPERCASE" onClick={handleUpperCase} disabled={!hasEditorTab}><CaseUpper size={IC} /></IconBtn>
        <IconBtn label="Transform to lowercase" onClick={handleLowerCase} disabled={!hasEditorTab}><CaseLower size={IC} /></IconBtn>
        <IconBtn label="Transform to Title Case" onClick={handleTitleCase} disabled={!hasEditorTab}><CaseSensitive size={IC} /></IconBtn>
      </div>

      <Sep />

      <div className="tb-group">
        <IconBtn label={`Indent Lines  ${sc("⌘]", "Ctrl+]")}`} onClick={handleIndent} disabled={!hasEditorTab}><Indent size={IC} /></IconBtn>
        <IconBtn label={`Outdent Lines  ${sc("⌘[", "Ctrl+[")}`} onClick={handleOutdent} disabled={!hasEditorTab}><Outdent size={IC} /></IconBtn>
        <IconBtn label="Trim Trailing Whitespace" onClick={handleTrimWS} disabled={!hasEditorTab}><Eraser size={IC} /></IconBtn>
        <IconBtn label={`Select Line  ${sc("⌘L", "Ctrl+L")}`} onClick={handleSelectLine} disabled={!hasEditorTab}><TextSelect size={IC} /></IconBtn>
      </div>

      {isDirty && (
        <span className="tb-dirty-pill" title="Unsaved changes">
          <span className="tb-dirty-dot" />
          unsaved
        </span>
      )}

      <div className="tb-group tb-settings-group">
        <IconBtn
          label={`Settings  ${sc("⌘,", "Ctrl+,")}`}
          onClick={handleSettings}
          active={isSettingsOpen}
        >
          <Settings2 size={IC} />
        </IconBtn>
      </div>
    </div>
  );
}
