import type * as monaco from "monaco-editor";

export interface Tab {
  id: string;
  filePath: string | null; // null for untitled files
  fileName: string;
  isDirty: boolean;
  language: string;
  modelUri: string; // Monaco model URI string
  cursorPosition: { lineNumber: number; column: number };
  scrollPosition: { scrollTop: number; scrollLeft: number };
  isSettings?: boolean; // true for the virtual Settings tab
}

// ─── Additional editor settings (beyond the legacy top-level fields) ─────────

export interface EditorSettings {
  // Font & display
  fontFamily: string;
  lineHeight: number;
  fontLigatures: boolean;
  // Word wrap
  wordWrapColumn: number;
  // Indentation
  tabSize: number;
  insertSpaces: boolean;
  detectIndentation: boolean;
  // Decorations
  renderWhitespace: "none" | "boundary" | "selection" | "trailing" | "all";
  lineNumbers: "on" | "off" | "relative";
  minimapSide: "left" | "right";
  // Cursor
  cursorBlinking: "blink" | "smooth" | "phase" | "expand" | "solid";
  cursorStyle: "line" | "block" | "underline" | "line-thin" | "block-outline" | "underline-thin";
  // Scrolling
  smoothScrolling: boolean;
  mouseWheelZoom: boolean;
  scrollBeyondLastLine: boolean;
  // Formatting
  formatOnPaste: boolean;
  formatOnType: boolean;
  // Editing
  autoClosingBrackets: "always" | "languageDefined" | "beforeWhitespace" | "never";
  autoClosingQuotes: "always" | "languageDefined" | "beforeWhitespace" | "never";
  bracketPairColorization: boolean;
  showBracketGuides: boolean;
  folding: boolean;
  links: boolean;
  // Suggestions
  quickSuggestions: boolean;
  parameterHints: boolean;
  acceptSuggestionOnEnter: "on" | "off" | "smart";
  tabCompletion: "on" | "off" | "onlySnippets";
  snippetSuggestions: "top" | "bottom" | "inline" | "none";
  // Brackets
  matchBrackets: "always" | "near" | "never";
  autoSurround: "languageDefined" | "brackets" | "quotes" | "never";
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontFamily: "monospace",
  lineHeight: 0,
  fontLigatures: false,
  wordWrapColumn: 80,
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: true,
  renderWhitespace: "selection",
  lineNumbers: "on",
  minimapSide: "right",
  cursorBlinking: "smooth",
  cursorStyle: "line",
  smoothScrolling: true,
  mouseWheelZoom: true,
  scrollBeyondLastLine: false,
  formatOnPaste: true,
  formatOnType: false,
  autoClosingBrackets: "always",
  autoClosingQuotes: "always",
  bracketPairColorization: true,
  showBracketGuides: true,
  folding: true,
  links: true,
  quickSuggestions: true,
  parameterHints: true,
  acceptSuggestionOnEnter: "on",
  tabCompletion: "on",
  snippetSuggestions: "inline",
  matchBrackets: "always",
  autoSurround: "languageDefined",
};

export interface EditorState {
  tabs: Tab[];
  activeTabId: string | null;
  theme: AppTheme;
  fontSize: number;
  wordWrap: "off" | "on";
  minimap: boolean;
  recentFiles: string[];
  settings: EditorSettings;
  isSettingsOpen: boolean;
  diagnostics: boolean;
}

export type AppTheme = "vs-dark" | "vs" | "hc-black";

export type EditorAction =
  | { type: "OPEN_TAB"; tab: Tab }
  | { type: "CLOSE_TAB"; tabId: string }
  | { type: "SET_ACTIVE_TAB"; tabId: string }
  | { type: "MARK_DIRTY"; tabId: string }
  | { type: "MARK_CLEAN"; tabId: string }
  | { type: "UPDATE_TAB_PATH"; tabId: string; filePath: string; fileName: string }
  | { type: "UPDATE_CURSOR"; tabId: string; position: { lineNumber: number; column: number } }
  | { type: "UPDATE_SCROLL"; tabId: string; position: { scrollTop: number; scrollLeft: number } }
  | { type: "SET_THEME"; theme: AppTheme }
  | { type: "SET_FONT_SIZE"; fontSize: number }
  | { type: "SET_WORD_WRAP"; wordWrap: "off" | "on" }
  | { type: "SET_MINIMAP"; minimap: boolean }
  | { type: "SET_RECENT_FILES"; recentFiles: string[] }
  | { type: "ADD_RECENT_FILE"; filePath: string }
  | { type: "SET_LANGUAGE"; tabId: string; language: string }
  | { type: "LOAD_SETTINGS"; settings: EditorSettings }
  | { type: "UPDATE_SETTING"; key: keyof EditorSettings; value: EditorSettings[keyof EditorSettings] }
  | { type: "OPEN_SETTINGS" }
  | { type: "CLOSE_SETTINGS" }
  | { type: "SET_DIAGNOSTICS"; diagnostics: boolean };

export interface EditorContextType {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
}

export interface StatusInfo {
  language: string;
  lineNumber: number;
  column: number;
  encoding: string;
  eol: string;
  indentation: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SETTINGS_TAB_ID = "__settings__";
export const MAX_RECENT_FILES = 20;
