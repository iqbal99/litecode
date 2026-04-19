import { useRef, useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import {
  setTheme,
  setFontSize,
  setWordWrap,
  setMinimap,
  setDiagnostics,
  loadSettings as loadSettingsAction,
  updateSetting,
} from "../store/editorSlice";
import {
  saveSettings,
  DEFAULT_PERSISTED_SETTINGS,
} from "../commands/settingsService";
import { showNotification } from "../commands/notifications";
import type { EditorSettings, AppTheme } from "../types";
import { DEFAULT_EDITOR_SETTINGS } from "../types";
import "./Settings.css";

const CATEGORIES = [
  { id: "appearance",   label: "Appearance" },
  { id: "editor",       label: "Editor" },
  { id: "indentation",  label: "Indentation" },
  { id: "cursor",       label: "Cursor" },
  { id: "scrolling",    label: "Scrolling" },
  { id: "formatting",   label: "Formatting" },
  { id: "guides",       label: "Guides & Brackets" },
  { id: "suggestions",  label: "Suggestions" },
];

const CANDIDATE_FONTS = [
  "Consolas",
  "Cascadia Mono",
  "Cascadia Code",
  "SF Mono",
  "Menlo",
  "Monaco",
  "Fira Code",
  "JetBrains Mono",
  "Source Code Pro",
  "Ubuntu Mono",
  "DejaVu Sans Mono",
  "Courier New",
];

function detectAvailableFonts(): string[] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return ["monospace"];

  const testStr = "mmmmmmmmmmlli1|WMwij";
  const size = "72px";

  ctx.font = `${size} monospace`;
  const baseWidth = ctx.measureText(testStr).width;

  const available: string[] = [];
  for (const font of CANDIDATE_FONTS) {
    ctx.font = `${size} '${font}', monospace`;
    if (ctx.measureText(testStr).width !== baseWidth) {
      available.push(font);
    }
  }
  available.push("monospace");
  return available;
}

interface RowProps {
  label: string;
  description?: string;
  hidden?: boolean;
  children: React.ReactNode;
}

function Row({ label, description, hidden, children }: RowProps) {
  if (hidden) return null;
  return (
    <div className="st-row">
      <div className="st-row-label">
        <span className="st-label-text">{label}</span>
        {description && <span className="st-label-desc">{description}</span>}
      </div>
      <div className="st-row-control">{children}</div>
    </div>
  );
}

function SectionHeader({ id, title, hidden }: { id: string; title: string; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <h2 id={`section-${id}`} className="st-section-header">
      {title}
    </h2>
  );
}

export default function Settings() {
  const theme = useAppSelector((s) => s.editor.theme);
  const fontSize = useAppSelector((s) => s.editor.fontSize);
  const wordWrap = useAppSelector((s) => s.editor.wordWrap);
  const minimapEnabled = useAppSelector((s) => s.editor.minimap);
  const diagnosticsEnabled = useAppSelector((s) => s.editor.diagnostics);
  const s = useAppSelector((s) => s.editor.settings);
  const dispatch = useAppDispatch();
  const contentRef = useRef<HTMLDivElement>(null);

  const [availableFonts, setAvailableFonts] = useState<string[]>(["monospace"]);
  useEffect(() => { setAvailableFonts(detectAvailableFonts()); }, []);

  // Focus the search input once when the Settings panel first appears, rather
  // than via `autoFocus` which steals focus on any remount.
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const q = searchQuery.toLowerCase();
  const match = (...terms: (string | undefined)[]) =>
    !q || terms.some((t) => t?.toLowerCase().includes(q));

  const handleSetTheme = (v: AppTheme) => {
    dispatch(setTheme(v));
  };

  const handleSetFontSize = (v: number) => {
    dispatch(setFontSize(Math.max(8, Math.min(72, v))));
  };

  const handleSetWordWrap = (v: "off" | "on") => {
    dispatch(setWordWrap(v));
  };

  const handleSetMinimap = (v: boolean) => {
    dispatch(setMinimap(v));
  };

  function setSetting<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) {
    dispatch(updateSetting(key, value));
  }

  const handleResetAll = async () => {
    const defaults = { ...DEFAULT_PERSISTED_SETTINGS };
    dispatch(setTheme(defaults.theme));
    dispatch(setFontSize(defaults.fontSize));
    dispatch(setWordWrap(defaults.wordWrap));
    dispatch(setMinimap(defaults.minimap));
    dispatch(setDiagnostics(defaults.diagnostics));
    dispatch(loadSettingsAction({ ...DEFAULT_EDITOR_SETTINGS }));
    const ok = await saveSettings(defaults);
    if (!ok) {
      showNotification(
        dispatch,
        "warning",
        "LiteCode could not persist the reset settings to disk."
      );
    }
  };

  const scrollTo = (id: string) => {
    const el = contentRef.current?.querySelector(`#section-${id}`) as HTMLElement | null;
    if (!el || !contentRef.current) return;
    const container = contentRef.current;
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div className="settings-page">
      <aside className="st-sidebar">
        <div className="st-sidebar-header">Settings</div>
        <input
          ref={searchInputRef}
          className="st-search-input"
          type="text"
          placeholder="Search settings…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <nav className="st-nav">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className="st-nav-item"
              onClick={() => scrollTo(c.id)}
            >
              {c.label}
            </button>
          ))}
        </nav>
        <div className="st-sidebar-footer">
          <button className="st-reset-btn" onClick={handleResetAll} title="Reset all settings to VS Code defaults">
            <RotateCcw size={13} />
            Reset to Defaults
          </button>
        </div>
      </aside>

      <main className="st-content" ref={contentRef}>
        <div className="st-content-inner">

          <SectionHeader id="appearance" title="Appearance" hidden={!match("Appearance", "Color Theme", "Font Family", "Font Size", "Line Height", "Font Ligatures")} />

          <Row label="Color Theme" description="Select the editor color theme." hidden={!match("Color Theme", "Select the editor color theme.")}>
            <select
              className="st-select"
              value={theme}
              onChange={(e) => handleSetTheme(e.target.value as AppTheme)}
            >
              <option value="vs-dark">Dark (VS Dark)</option>
              <option value="vs">Light (VS)</option>
              <option value="hc-black">High Contrast Black</option>
            </select>
          </Row>

          <Row label="Font Family" description="Controls the font family in the editor." hidden={!match("Font Family", "Controls the font family in the editor.")}>
            <select
              className="st-select"
              value={s.fontFamily}
              onChange={(e) => setSetting("fontFamily", e.target.value)}
            >
              {!availableFonts.includes(s.fontFamily) && s.fontFamily && (
                <option value={s.fontFamily}>{s.fontFamily}</option>
              )}
              {availableFonts.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Row>

          <Row label="Font Size" description="Controls the font size in pixels (8–72)." hidden={!match("Font Size", "Controls the font size in pixels")}>
            <div className="st-number-row">
              <button className="st-stepper" onClick={() => handleSetFontSize(fontSize - 1)}>−</button>
              <input
                className="st-input st-input-number"
                type="number"
                min={8}
                max={72}
                value={fontSize}
                onChange={(e) => handleSetFontSize(parseInt(e.target.value, 10) || 14)}
              />
              <button className="st-stepper" onClick={() => handleSetFontSize(fontSize + 1)}>+</button>
            </div>
          </Row>

          <Row label="Line Height" description="Controls the line height. Use 0 to automatically compute from font size." hidden={!match("Line Height", "Controls the line height")}>
            <div className="st-number-row">
              <button className="st-stepper" onClick={() => setSetting("lineHeight", Math.max(0, s.lineHeight - 1))}>−</button>
              <input
                className="st-input st-input-number"
                type="number"
                min={0}
                max={100}
                value={s.lineHeight}
                onChange={(e) => setSetting("lineHeight", parseInt(e.target.value, 10) || 0)}
              />
              <button className="st-stepper" onClick={() => setSetting("lineHeight", Math.min(100, s.lineHeight + 1))}>+</button>
            </div>
          </Row>

          <Row label="Font Ligatures" description="Enable font ligatures (requires a ligature-enabled font)." hidden={!match("Font Ligatures", "Enable font ligatures")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.fontLigatures}
                onChange={(e) => setSetting("fontLigatures", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <SectionHeader id="editor" title="Editor" hidden={!match("Editor", "Word Wrap", "Line Numbers", "Minimap", "Whitespace", "Folding", "Links", "Diagnostics")} />

          <Row label="Word Wrap" description="Controls how lines should wrap." hidden={!match("Word Wrap", "Controls how lines should wrap")}>
            <select
              className="st-select"
              value={wordWrap}
              onChange={(e) => handleSetWordWrap(e.target.value as "off" | "on")}
            >
              <option value="off">Off</option>
              <option value="on">On</option>
            </select>
          </Row>

          <Row label="Word Wrap Column" description="Controls the column at which to wrap lines when word wrap is set to bounded." hidden={!match("Word Wrap Column", "Controls the column")}>
            <div className="st-number-row">
              <button className="st-stepper" onClick={() => setSetting("wordWrapColumn", Math.max(1, s.wordWrapColumn - 1))}>−</button>
              <input
                className="st-input st-input-number"
                type="number"
                min={1}
                max={500}
                value={s.wordWrapColumn}
                onChange={(e) => setSetting("wordWrapColumn", parseInt(e.target.value, 10) || 80)}
              />
              <button className="st-stepper" onClick={() => setSetting("wordWrapColumn", Math.min(500, s.wordWrapColumn + 1))}>+</button>
            </div>
          </Row>

          <Row label="Line Numbers" description="Controls the display of line numbers." hidden={!match("Line Numbers", "Controls the display of line numbers")}>
            <select
              className="st-select"
              value={s.lineNumbers}
              onChange={(e) => setSetting("lineNumbers", e.target.value as EditorSettings["lineNumbers"])}
            >
              <option value="on">On</option>
              <option value="off">Off</option>
              <option value="relative">Relative</option>
            </select>
          </Row>

          <Row label="Minimap" description="Controls whether the minimap is shown." hidden={!match("Minimap", "Controls whether the minimap")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={minimapEnabled}
                onChange={(e) => handleSetMinimap(e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Minimap Side" description="Controls the side where to render the minimap." hidden={!match("Minimap Side", "Controls the side where")}>
            <select
              className="st-select"
              value={s.minimapSide}
              onChange={(e) => setSetting("minimapSide", e.target.value as "left" | "right")}
            >
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </Row>

          <Row label="Render Whitespace" description="Controls how the editor should render whitespace characters." hidden={!match("Render Whitespace", "whitespace characters")}>
            <select
              className="st-select"
              value={s.renderWhitespace}
              onChange={(e) => setSetting("renderWhitespace", e.target.value as EditorSettings["renderWhitespace"])}
            >
              <option value="none">None</option>
              <option value="boundary">Boundary</option>
              <option value="selection">Selection</option>
              <option value="trailing">Trailing</option>
              <option value="all">All</option>
            </select>
          </Row>

          <Row label="Folding" description="Controls whether the editor has code folding enabled." hidden={!match("Folding", "code folding")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.folding}
                onChange={(e) => setSetting("folding", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Links" description="Controls whether the editor should detect links and make them clickable." hidden={!match("Links", "detect links")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.links}
                onChange={(e) => setSetting("links", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Show Diagnostics" description="Controls whether diagnostic markers (errors, warnings) are shown in the editor." hidden={!match("Diagnostics", "diagnostic markers")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={diagnosticsEnabled}
                onChange={(e) => dispatch(setDiagnostics(e.target.checked))}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <SectionHeader id="indentation" title="Indentation" hidden={!match("Indentation", "Tab Size", "Insert Spaces", "Detect Indentation")} />

          <Row label="Tab Size" description="The number of spaces a tab is equal to." hidden={!match("Tab Size", "spaces a tab")}>
            <div className="st-number-row">
              <button className="st-stepper" onClick={() => setSetting("tabSize", Math.max(1, s.tabSize - 1))}>−</button>
              <input
                className="st-input st-input-number"
                type="number"
                min={1}
                max={16}
                value={s.tabSize}
                onChange={(e) => setSetting("tabSize", parseInt(e.target.value, 10) || 2)}
              />
              <button className="st-stepper" onClick={() => setSetting("tabSize", Math.min(16, s.tabSize + 1))}>+</button>
            </div>
          </Row>

          <Row label="Insert Spaces" description="Insert spaces when pressing Tab. This setting is overridden based on the file contents when Detect Indentation is on." hidden={!match("Insert Spaces", "spaces when pressing Tab")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.insertSpaces}
                onChange={(e) => setSetting("insertSpaces", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Detect Indentation" description="Controls whether to detect indentation from the file content on open." hidden={!match("Detect Indentation", "detect indentation")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.detectIndentation}
                onChange={(e) => setSetting("detectIndentation", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <SectionHeader id="cursor" title="Cursor" hidden={!match("Cursor", "Cursor Blinking", "Cursor Style")} />

          <Row label="Cursor Blinking" description="Controls the cursor animation style." hidden={!match("Cursor Blinking", "cursor animation")}>
            <select
              className="st-select"
              value={s.cursorBlinking}
              onChange={(e) => setSetting("cursorBlinking", e.target.value as EditorSettings["cursorBlinking"])}
            >
              <option value="blink">Blink</option>
              <option value="smooth">Smooth</option>
              <option value="phase">Phase</option>
              <option value="expand">Expand</option>
              <option value="solid">Solid</option>
            </select>
          </Row>

          <Row label="Cursor Style" description="Controls the cursor style." hidden={!match("Cursor Style", "Controls the cursor style")}>
            <select
              className="st-select"
              value={s.cursorStyle}
              onChange={(e) => setSetting("cursorStyle", e.target.value as EditorSettings["cursorStyle"])}
            >
              <option value="line">Line</option>
              <option value="block">Block</option>
              <option value="underline">Underline</option>
              <option value="line-thin">Line Thin</option>
              <option value="block-outline">Block Outline</option>
              <option value="underline-thin">Underline Thin</option>
            </select>
          </Row>

          <SectionHeader id="scrolling" title="Scrolling" hidden={!match("Scrolling", "Smooth Scrolling", "Mouse Wheel Zoom", "Scroll Beyond")} />

          <Row label="Smooth Scrolling" description="Controls whether the editor will scroll using an animation." hidden={!match("Smooth Scrolling", "scroll using an animation")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.smoothScrolling}
                onChange={(e) => setSetting("smoothScrolling", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Mouse Wheel Zoom" description="Zoom the font of the editor when using mouse wheel and holding Ctrl." hidden={!match("Mouse Wheel Zoom", "mouse wheel")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.mouseWheelZoom}
                onChange={(e) => setSetting("mouseWheelZoom", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Scroll Beyond Last Line" description="Controls whether the editor will scroll beyond the last line." hidden={!match("Scroll Beyond Last Line", "scroll beyond")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.scrollBeyondLastLine}
                onChange={(e) => setSetting("scrollBeyondLastLine", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <SectionHeader id="formatting" title="Formatting" hidden={!match("Formatting", "Format On Paste", "Format On Type", "Auto Closing Brackets", "Auto Closing Quotes")} />

          <Row label="Format On Paste" description="Controls whether the editor should automatically format the pasted content." hidden={!match("Format On Paste", "format the pasted content")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.formatOnPaste}
                onChange={(e) => setSetting("formatOnPaste", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Format On Type" description="Controls whether the editor should automatically format the line after typing." hidden={!match("Format On Type", "format the line after typing")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.formatOnType}
                onChange={(e) => setSetting("formatOnType", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Auto Closing Brackets" description="Controls whether the editor should auto-close brackets after the user adds an opening bracket." hidden={!match("Auto Closing Brackets", "auto-close brackets")}>
            <select
              className="st-select"
              value={s.autoClosingBrackets}
              onChange={(e) => setSetting("autoClosingBrackets", e.target.value as EditorSettings["autoClosingBrackets"])}
            >
              <option value="always">Always</option>
              <option value="languageDefined">Language Defined</option>
              <option value="beforeWhitespace">Before Whitespace</option>
              <option value="never">Never</option>
            </select>
          </Row>

          <Row label="Auto Closing Quotes" description="Controls whether the editor should auto-close quotes after the user adds an opening quote." hidden={!match("Auto Closing Quotes", "auto-close quotes")}>
            <select
              className="st-select"
              value={s.autoClosingQuotes}
              onChange={(e) => setSetting("autoClosingQuotes", e.target.value as EditorSettings["autoClosingQuotes"])}
            >
              <option value="always">Always</option>
              <option value="languageDefined">Language Defined</option>
              <option value="beforeWhitespace">Before Whitespace</option>
              <option value="never">Never</option>
            </select>
          </Row>

          <SectionHeader id="guides" title="Guides & Brackets" hidden={!match("Guides", "Brackets", "Bracket Pair", "Match Brackets", "Auto Surround")} />

          <Row label="Bracket Pair Colorization" description="Controls whether bracket pair colorization is enabled." hidden={!match("Bracket Pair Colorization", "bracket pair colorization")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.bracketPairColorization}
                onChange={(e) => setSetting("bracketPairColorization", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Bracket Pair Guides" description="Controls whether bracket pair guides are enabled." hidden={!match("Bracket Pair Guides", "bracket pair guides")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.showBracketGuides}
                onChange={(e) => setSetting("showBracketGuides", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Match Brackets" description="Controls whether the editor should highlight matching brackets." hidden={!match("Match Brackets", "highlight matching brackets")}>
            <select
              className="st-select"
              value={s.matchBrackets}
              onChange={(e) => setSetting("matchBrackets", e.target.value as EditorSettings["matchBrackets"])}
            >
              <option value="always">Always</option>
              <option value="near">Near</option>
              <option value="never">Never</option>
            </select>
          </Row>

          <Row label="Auto Surround" description="Controls whether the editor should automatically surround selections." hidden={!match("Auto Surround", "surround selections")}>
            <select
              className="st-select"
              value={s.autoSurround}
              onChange={(e) => setSetting("autoSurround", e.target.value as EditorSettings["autoSurround"])}
            >
              <option value="languageDefined">Language Defined</option>
              <option value="brackets">Brackets</option>
              <option value="quotes">Quotes</option>
              <option value="never">Never</option>
            </select>
          </Row>

          <SectionHeader id="suggestions" title="Suggestions" hidden={!match("Suggestions", "Quick Suggestions", "Parameter Hints", "Accept Suggestion", "Tab Completion", "Snippet")} />

          <Row label="Quick Suggestions" description="Controls whether suggestions should automatically show up while typing." hidden={!match("Quick Suggestions", "suggestions should automatically")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.quickSuggestions}
                onChange={(e) => setSetting("quickSuggestions", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Parameter Hints" description="Enables a pop-up that shows parameter documentation and type information as you type." hidden={!match("Parameter Hints", "parameter documentation")}>
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.parameterHints}
                onChange={(e) => setSetting("parameterHints", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Accept Suggestion On Enter" description="Controls whether suggestions are accepted with the Enter key, in addition to Tab." hidden={!match("Accept Suggestion On Enter", "suggestions are accepted")}>
            <select
              className="st-select"
              value={s.acceptSuggestionOnEnter}
              onChange={(e) => setSetting("acceptSuggestionOnEnter", e.target.value as EditorSettings["acceptSuggestionOnEnter"])}
            >
              <option value="on">On</option>
              <option value="smart">Smart</option>
              <option value="off">Off</option>
            </select>
          </Row>

          <Row label="Tab Completion" description="Enables tab completions." hidden={!match("Tab Completion", "tab completions")}>
            <select
              className="st-select"
              value={s.tabCompletion}
              onChange={(e) => setSetting("tabCompletion", e.target.value as EditorSettings["tabCompletion"])}
            >
              <option value="on">On</option>
              <option value="onlySnippets">Only Snippets</option>
              <option value="off">Off</option>
            </select>
          </Row>

          <Row label="Snippet Suggestions" description="Controls whether snippets are shown with other suggestions and how they are sorted." hidden={!match("Snippet Suggestions", "snippets are shown")}>
            <select
              className="st-select"
              value={s.snippetSuggestions}
              onChange={(e) => setSetting("snippetSuggestions", e.target.value as EditorSettings["snippetSuggestions"])}
            >
              <option value="inline">Inline</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="none">None</option>
            </select>
          </Row>

          <div className="st-bottom-spacer" />
        </div>
      </main>
    </div>
  );
}
