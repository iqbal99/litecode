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
  notifications: AppNotification[];
  notificationSeq: number;
}

export type AppTheme = "vs-dark" | "vs" | "hc-black";

export interface StatusInfo {
  language: string;
  lineNumber: number;
  column: number;
  encoding: string;
  eol: string;
  indentation: string;
}

export interface AppNotification {
  id: number;
  kind: "info" | "warning" | "error";
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SETTINGS_TAB_ID = "__settings__";
export const MAX_RECENT_FILES = 20;
