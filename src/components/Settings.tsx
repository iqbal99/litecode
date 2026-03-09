import { useRef, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import { useEditor } from "../store/editorStore";
import {
  saveSettings,
  DEFAULT_PERSISTED_SETTINGS,
  type PersistedSettings,
} from "../commands/settingsService";
import type { EditorSettings, AppTheme } from "../types";
import { DEFAULT_EDITOR_SETTINGS } from "../types";
import "./Settings.css";

// ─── Category ids for nav scroll ─────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCurrent(
  theme: AppTheme,
  fontSize: number,
  wordWrap: "off" | "on",
  minimap: boolean,
  settings: EditorSettings
): PersistedSettings {
  return {
    ...settings,
    theme,
    fontSize,
    wordWrap,
    minimap,
  };
}

// ─── Small reusable row ───────────────────────────────────────────────────────

interface RowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function Row({ label, description, children }: RowProps) {
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

function SectionHeader({ id, title }: { id: string; title: string }) {
  return (
    <h2 id={`section-${id}`} className="st-section-header">
      {title}
    </h2>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Settings() {
  const { state, dispatch } = useEditor();
  const contentRef = useRef<HTMLDivElement>(null);

  const s = state.settings;

  // Build the full persisted object from current state and save it
  const persist = useCallback(
    (patch: Partial<PersistedSettings>) => {
      const current = buildCurrent(
        state.theme,
        state.fontSize,
        state.wordWrap,
        state.minimap,
        state.settings
      );
      saveSettings({ ...current, ...patch });
    },
    [state]
  );

  // ── Unified change helpers ────────────────────────────────────────────────

  const setTheme = (v: AppTheme) => {
    dispatch({ type: "SET_THEME", theme: v });
    persist({ theme: v });
  };

  const setFontSize = (v: number) => {
    const clamped = Math.max(8, Math.min(72, v));
    dispatch({ type: "SET_FONT_SIZE", fontSize: clamped });
    persist({ fontSize: clamped });
  };

  const setWordWrap = (v: "off" | "on") => {
    dispatch({ type: "SET_WORD_WRAP", wordWrap: v });
    persist({ wordWrap: v });
  };

  const setMinimap = (v: boolean) => {
    dispatch({ type: "SET_MINIMAP", minimap: v });
    persist({ minimap: v });
  };

  function setSetting<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) {
    dispatch({ type: "UPDATE_SETTING", key, value: value as EditorSettings[keyof EditorSettings] });
    persist({ [key]: value } as Partial<PersistedSettings>);
  }

  // ── Reset to defaults ─────────────────────────────────────────────────────

  const handleResetAll = async () => {
    const defaults = { ...DEFAULT_PERSISTED_SETTINGS };
    dispatch({ type: "SET_THEME", theme: defaults.theme });
    dispatch({ type: "SET_FONT_SIZE", fontSize: defaults.fontSize });
    dispatch({ type: "SET_WORD_WRAP", wordWrap: defaults.wordWrap });
    dispatch({ type: "SET_MINIMAP", minimap: defaults.minimap });
    dispatch({ type: "LOAD_SETTINGS", settings: { ...DEFAULT_EDITOR_SETTINGS } });
    await saveSettings(defaults);
  };

  // ── Nav scroll ────────────────────────────────────────────────────────────

  const scrollTo = (id: string) => {
    const el = contentRef.current?.querySelector(`#section-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="settings-page">
      {/* ── Sidebar ── */}
      <aside className="st-sidebar">
        <div className="st-sidebar-header">Settings</div>
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

      {/* ── Content ── */}
      <main className="st-content" ref={contentRef}>
        <div className="st-content-inner">

          {/* ──────────────────── APPEARANCE ──────────────────── */}
          <SectionHeader id="appearance" title="Appearance" />

          <Row label="Color Theme" description="Select the editor color theme.">
            <select
              className="st-select"
              value={state.theme}
              onChange={(e) => setTheme(e.target.value as AppTheme)}
            >
              <option value="vs-dark">Dark (VS Dark)</option>
              <option value="vs">Light (VS)</option>
              <option value="hc-black">High Contrast Black</option>
            </select>
          </Row>

          <Row label="Font Family" description="Controls the font family in the editor.">
            <input
              className="st-input"
              type="text"
              value={s.fontFamily}
              onChange={(e) => setSetting("fontFamily", e.target.value)}
              placeholder="Menlo, Monaco, 'Courier New', monospace"
              spellCheck={false}
            />
          </Row>

          <Row label="Font Size" description="Controls the font size in pixels (8–72).">
            <div className="st-number-row">
              <button className="st-stepper" onClick={() => setFontSize(state.fontSize - 1)}>−</button>
              <input
                className="st-input st-input-number"
                type="number"
                min={8}
                max={72}
                value={state.fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value, 10) || 14)}
              />
              <button className="st-stepper" onClick={() => setFontSize(state.fontSize + 1)}>+</button>
            </div>
          </Row>

          <Row label="Line Height" description="Controls the line height. Use 0 to automatically compute from font size.">
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

          <Row label="Font Ligatures" description="Enable font ligatures (requires a ligature-enabled font).">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.fontLigatures}
                onChange={(e) => setSetting("fontLigatures", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          {/* ──────────────────── EDITOR ──────────────────── */}
          <SectionHeader id="editor" title="Editor" />

          <Row label="Word Wrap" description="Controls how lines should wrap.">
            <select
              className="st-select"
              value={state.wordWrap}
              onChange={(e) => setWordWrap(e.target.value as "off" | "on")}
            >
              <option value="off">Off</option>
              <option value="on">On</option>
            </select>
          </Row>

          <Row label="Word Wrap Column" description="Controls the column at which to wrap lines when word wrap is set to bounded.">
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

          <Row label="Line Numbers" description="Controls the display of line numbers.">
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

          <Row label="Minimap" description="Controls whether the minimap is shown.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={state.minimap}
                onChange={(e) => setMinimap(e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Minimap Side" description="Controls the side where to render the minimap.">
            <select
              className="st-select"
              value={s.minimapSide}
              onChange={(e) => setSetting("minimapSide", e.target.value as "left" | "right")}
            >
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </Row>

          <Row label="Render Whitespace" description="Controls how the editor should render whitespace characters.">
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

          <Row label="Folding" description="Controls whether the editor has code folding enabled.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.folding}
                onChange={(e) => setSetting("folding", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Links" description="Controls whether the editor should detect links and make them clickable.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.links}
                onChange={(e) => setSetting("links", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          {/* ──────────────────── INDENTATION ──────────────────── */}
          <SectionHeader id="indentation" title="Indentation" />

          <Row label="Tab Size" description="The number of spaces a tab is equal to.">
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

          <Row label="Insert Spaces" description="Insert spaces when pressing Tab. This setting is overridden based on the file contents when Detect Indentation is on.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.insertSpaces}
                onChange={(e) => setSetting("insertSpaces", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Detect Indentation" description="Controls whether to detect indentation from the file content on open.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.detectIndentation}
                onChange={(e) => setSetting("detectIndentation", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          {/* ──────────────────── CURSOR ──────────────────── */}
          <SectionHeader id="cursor" title="Cursor" />

          <Row label="Cursor Blinking" description="Controls the cursor animation style.">
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

          <Row label="Cursor Style" description="Controls the cursor style.">
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

          {/* ──────────────────── SCROLLING ──────────────────── */}
          <SectionHeader id="scrolling" title="Scrolling" />

          <Row label="Smooth Scrolling" description="Controls whether the editor will scroll using an animation.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.smoothScrolling}
                onChange={(e) => setSetting("smoothScrolling", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Mouse Wheel Zoom" description="Zoom the font of the editor when using mouse wheel and holding Ctrl.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.mouseWheelZoom}
                onChange={(e) => setSetting("mouseWheelZoom", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Scroll Beyond Last Line" description="Controls whether the editor will scroll beyond the last line.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.scrollBeyondLastLine}
                onChange={(e) => setSetting("scrollBeyondLastLine", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          {/* ──────────────────── FORMATTING ──────────────────── */}
          <SectionHeader id="formatting" title="Formatting" />

          <Row label="Format On Paste" description="Controls whether the editor should automatically format the pasted content.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.formatOnPaste}
                onChange={(e) => setSetting("formatOnPaste", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Format On Type" description="Controls whether the editor should automatically format the line after typing.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.formatOnType}
                onChange={(e) => setSetting("formatOnType", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Auto Closing Brackets" description="Controls whether the editor should auto-close brackets after the user adds an opening bracket.">
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

          <Row label="Auto Closing Quotes" description="Controls whether the editor should auto-close quotes after the user adds an opening quote.">
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

          {/* ──────────────────── GUIDES & BRACKETS ──────────────────── */}
          <SectionHeader id="guides" title="Guides & Brackets" />

          <Row label="Bracket Pair Colorization" description="Controls whether bracket pair colorization is enabled.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.bracketPairColorization}
                onChange={(e) => setSetting("bracketPairColorization", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Bracket Pair Guides" description="Controls whether bracket pair guides are enabled.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.showBracketGuides}
                onChange={(e) => setSetting("showBracketGuides", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Match Brackets" description="Controls whether the editor should highlight matching brackets.">
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

          <Row label="Auto Surround" description="Controls whether the editor should automatically surround selections.">
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

          {/* ──────────────────── SUGGESTIONS ──────────────────── */}
          <SectionHeader id="suggestions" title="Suggestions" />

          <Row label="Quick Suggestions" description="Controls whether suggestions should automatically show up while typing.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.quickSuggestions}
                onChange={(e) => setSetting("quickSuggestions", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Parameter Hints" description="Enables a pop-up that shows parameter documentation and type information as you type.">
            <label className="st-toggle">
              <input
                type="checkbox"
                checked={s.parameterHints}
                onChange={(e) => setSetting("parameterHints", e.target.checked)}
              />
              <span className="st-toggle-track" />
            </label>
          </Row>

          <Row label="Accept Suggestion On Enter" description="Controls whether suggestions are accepted with the Enter key, in addition to Tab.">
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

          <Row label="Tab Completion" description="Enables tab completions.">
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

          <Row label="Snippet Suggestions" description="Controls whether snippets are shown with other suggestions and how they are sorted.">
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
