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
}

export interface EditorState {
  tabs: Tab[];
  activeTabId: string | null;
  theme: AppTheme;
  fontSize: number;
  wordWrap: "off" | "on";
  minimap: boolean;
  recentFiles: string[];
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
  | { type: "SET_LANGUAGE"; tabId: string; language: string };

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
