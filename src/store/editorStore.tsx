import React, { createContext, useContext, useReducer, useRef } from "react";
import type * as monaco from "monaco-editor";
import type { EditorState, EditorAction, EditorContextType } from "../types";
import { DEFAULT_EDITOR_SETTINGS, SETTINGS_TAB_ID, MAX_RECENT_FILES } from "../types";

export const initialState: EditorState = {
  tabs: [],
  activeTabId: null,
  theme: "vs-dark",
  fontSize: 14,
  wordWrap: "off",
  minimap: true,
  recentFiles: [],
  settings: { ...DEFAULT_EDITOR_SETTINGS },
  isSettingsOpen: false,
  diagnostics: true,
};

export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case "OPEN_TAB": {
      // Check if tab for this file already exists
      const existing = action.tab.filePath
        ? state.tabs.find((t) => t.filePath === action.tab.filePath)
        : null;
      if (existing) {
        return { ...state, activeTabId: existing.id };
      }
      return {
        ...state,
        tabs: [...state.tabs, action.tab],
        activeTabId: action.tab.id,
      };
    }

    case "CLOSE_TAB": {
      const closingTab = state.tabs.find((t) => t.id === action.tabId);
      const idx = state.tabs.findIndex((t) => t.id === action.tabId);
      const newTabs = state.tabs.filter((t) => t.id !== action.tabId);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === action.tabId) {
        if (newTabs.length === 0) {
          newActiveId = null;
        } else if (idx >= newTabs.length) {
          newActiveId = newTabs[newTabs.length - 1].id;
        } else {
          newActiveId = newTabs[idx].id;
        }
      }
      return {
        ...state,
        tabs: newTabs,
        activeTabId: newActiveId,
        ...(closingTab?.isSettings ? { isSettingsOpen: false } : {}),
      };
    }

    case "SET_ACTIVE_TAB": {
      const exists = state.tabs.some((t) => t.id === action.tabId);
      return exists ? { ...state, activeTabId: action.tabId } : state;
    }

    case "MARK_DIRTY":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, isDirty: true } : t
        ),
      };

    case "MARK_CLEAN":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, isDirty: false } : t
        ),
      };

    case "UPDATE_TAB_PATH":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId
            ? { ...t, filePath: action.filePath, fileName: action.fileName }
            : t
        ),
      };

    case "UPDATE_CURSOR":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, cursorPosition: action.position } : t
        ),
      };

    case "UPDATE_SCROLL":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, scrollPosition: action.position } : t
        ),
      };

    case "SET_THEME":
      return { ...state, theme: action.theme };

    case "SET_FONT_SIZE":
      return { ...state, fontSize: Math.max(8, Math.min(32, action.fontSize)) };

    case "SET_WORD_WRAP":
      return { ...state, wordWrap: action.wordWrap };

    case "SET_MINIMAP":
      return { ...state, minimap: action.minimap };

    case "SET_RECENT_FILES":
      return { ...state, recentFiles: action.recentFiles };

    case "ADD_RECENT_FILE": {
      const filtered = state.recentFiles.filter((f) => f !== action.filePath);
      const updated = [action.filePath, ...filtered].slice(0, MAX_RECENT_FILES);
      return { ...state, recentFiles: updated };
    }

    case "SET_LANGUAGE":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, language: action.language } : t
        ),
      };

    case "LOAD_SETTINGS":
      return { ...state, settings: { ...DEFAULT_EDITOR_SETTINGS, ...action.settings } };

    case "UPDATE_SETTING":
      return {
        ...state,
        settings: { ...state.settings, [action.key]: action.value },
      };

    case "OPEN_SETTINGS": {
      const alreadyOpen = state.tabs.find((t) => t.isSettings);
      if (alreadyOpen) {
        return { ...state, activeTabId: SETTINGS_TAB_ID, isSettingsOpen: true };
      }
      const settingsTab: import("../types").Tab = {
        id: SETTINGS_TAB_ID,
        fileName: "Settings",
        filePath: null,
        isDirty: false,
        language: "",
        modelUri: "",
        isSettings: true,
        cursorPosition: { lineNumber: 1, column: 1 },
        scrollPosition: { scrollTop: 0, scrollLeft: 0 },
      };
      return {
        ...state,
        tabs: [...state.tabs, settingsTab],
        activeTabId: "__settings__",
        isSettingsOpen: true,
      };
    }

    case "CLOSE_SETTINGS": {
      const newTabs = state.tabs.filter((t) => !t.isSettings);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === SETTINGS_TAB_ID) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      return { ...state, tabs: newTabs, activeTabId: newActiveId, isSettingsOpen: false };
    }

    case "SET_DIAGNOSTICS":
      return { ...state, diagnostics: action.diagnostics };

    default:
      return state;
  }
}

const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  return (
    <EditorContext.Provider value={{ state, dispatch, editorRef }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor(): EditorContextType {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
