import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  EditorState,
  Tab,
  AppTheme,
  AppNotification,
  EditorSettings,
} from "../types";
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
  notifications: [],
  notificationSeq: 0,
};

function findTab(state: EditorState, tabId: string) {
  return state.tabs.find((t) => t.id === tabId);
}

const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    openTab(state, action: PayloadAction<Tab>) {
      const tab = action.payload;
      const existing = tab.filePath
        ? state.tabs.find((t) => t.filePath === tab.filePath)
        : null;
      if (existing) {
        state.activeTabId = existing.id;
        return;
      }
      state.tabs.push(tab);
      state.activeTabId = tab.id;
    },

    closeTab(state, action: PayloadAction<string>) {
      const tabId = action.payload;
      const closingTab = findTab(state, tabId);
      const idx = state.tabs.findIndex((t) => t.id === tabId);
      state.tabs = state.tabs.filter((t) => t.id !== tabId);

      if (state.activeTabId === tabId) {
        if (state.tabs.length === 0) {
          state.activeTabId = null;
        } else if (idx >= state.tabs.length) {
          state.activeTabId = state.tabs[state.tabs.length - 1].id;
        } else {
          state.activeTabId = state.tabs[idx].id;
        }
      }
      if (closingTab?.isSettings) {
        state.isSettingsOpen = false;
      }
    },

    setActiveTab(state, action: PayloadAction<string>) {
      const exists = state.tabs.some((t) => t.id === action.payload);
      if (exists) state.activeTabId = action.payload;
    },

    markDirty(state, action: PayloadAction<string>) {
      const tab = findTab(state, action.payload);
      if (tab) tab.isDirty = true;
    },

    markClean(state, action: PayloadAction<string>) {
      const tab = findTab(state, action.payload);
      if (tab) tab.isDirty = false;
    },

    updateTabPath(
      state,
      action: PayloadAction<{ tabId: string; filePath: string; fileName: string }>
    ) {
      const tab = findTab(state, action.payload.tabId);
      if (tab) {
        tab.filePath = action.payload.filePath;
        tab.fileName = action.payload.fileName;
      }
    },

    updateCursor(
      state,
      action: PayloadAction<{
        tabId: string;
        position: { lineNumber: number; column: number };
      }>
    ) {
      const tab = findTab(state, action.payload.tabId);
      if (tab) tab.cursorPosition = action.payload.position;
    },

    updateScroll(
      state,
      action: PayloadAction<{
        tabId: string;
        position: { scrollTop: number; scrollLeft: number };
      }>
    ) {
      const tab = findTab(state, action.payload.tabId);
      if (tab) tab.scrollPosition = action.payload.position;
    },

    setTheme(state, action: PayloadAction<AppTheme>) {
      state.theme = action.payload;
    },

    setFontSize(state, action: PayloadAction<number>) {
      state.fontSize = Math.max(8, Math.min(72, action.payload));
    },

    setWordWrap(state, action: PayloadAction<"off" | "on">) {
      state.wordWrap = action.payload;
    },

    setMinimap(state, action: PayloadAction<boolean>) {
      state.minimap = action.payload;
    },

    setRecentFiles(state, action: PayloadAction<string[]>) {
      state.recentFiles = action.payload;
    },

    addRecentFile(state, action: PayloadAction<string>) {
      const filtered = state.recentFiles.filter((f) => f !== action.payload);
      state.recentFiles = [action.payload, ...filtered].slice(
        0,
        MAX_RECENT_FILES
      );
    },

    setLanguage(
      state,
      action: PayloadAction<{ tabId: string; language: string }>
    ) {
      const tab = findTab(state, action.payload.tabId);
      if (tab) tab.language = action.payload.language;
    },

    updateTabFileInfo(
      state,
      action: PayloadAction<{
        tabId: string;
        filePath: string;
        fileName: string;
        language: string;
        modelUri: string;
      }>
    ) {
      const tab = findTab(state, action.payload.tabId);
      if (tab) {
        tab.filePath = action.payload.filePath;
        tab.fileName = action.payload.fileName;
        tab.language = action.payload.language;
        tab.modelUri = action.payload.modelUri;
      }
    },

    loadSettings(state, action: PayloadAction<EditorSettings>) {
      state.settings = { ...DEFAULT_EDITOR_SETTINGS, ...action.payload };
    },

    updateSetting: {
      reducer(
        state,
        action: PayloadAction<{
          key: keyof EditorSettings;
          value: EditorSettings[keyof EditorSettings];
        }>
      ) {
        const { key, value } = action.payload;
        // Assign via a typed pass-through. Keys are constrained to EditorSettings
        // and values to EditorSettings[K] at call sites below.
        state.settings[key] = value as never;
      },
      prepare<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) {
        return { payload: { key, value } };
      },
    },

    openSettings(state) {
      const alreadyOpen = state.tabs.find((t) => t.isSettings);
      if (alreadyOpen) {
        state.activeTabId = SETTINGS_TAB_ID;
        state.isSettingsOpen = true;
        return;
      }
      state.tabs.push({
        id: SETTINGS_TAB_ID,
        fileName: "Settings",
        filePath: null,
        isDirty: false,
        language: "",
        modelUri: "",
        isSettings: true,
        cursorPosition: { lineNumber: 1, column: 1 },
        scrollPosition: { scrollTop: 0, scrollLeft: 0 },
      });
      state.activeTabId = SETTINGS_TAB_ID;
      state.isSettingsOpen = true;
    },

    closeSettings(state) {
      state.tabs = state.tabs.filter((t) => !t.isSettings);
      if (state.activeTabId === SETTINGS_TAB_ID) {
        state.activeTabId =
          state.tabs.length > 0 ? state.tabs[state.tabs.length - 1].id : null;
      }
      state.isSettingsOpen = false;
    },

    setDiagnostics(state, action: PayloadAction<boolean>) {
      state.diagnostics = action.payload;
    },

    showNotification: {
      reducer(
        state,
        action: PayloadAction<{ kind: AppNotification["kind"]; message: string }>
      ) {
        state.notificationSeq += 1;
        const note: AppNotification = {
          id: state.notificationSeq,
          kind: action.payload.kind,
          message: action.payload.message,
        };
        state.notifications.push(note);
        if (state.notifications.length > 5) {
          state.notifications = state.notifications.slice(-5);
        }
      },
      prepare(kind: AppNotification["kind"], message: string) {
        return { payload: { kind, message } };
      },
    },

    clearNotification(state, action: PayloadAction<number>) {
      state.notifications = state.notifications.filter(
        (n) => n.id !== action.payload
      );
    },
  },
});

export const {
  openTab,
  closeTab,
  setActiveTab,
  markDirty,
  markClean,
  updateTabPath,
  updateCursor,
  updateScroll,
  setTheme,
  setFontSize,
  setWordWrap,
  setMinimap,
  setRecentFiles,
  addRecentFile,
  setLanguage,
  updateTabFileInfo,
  loadSettings,
  updateSetting,
  openSettings,
  closeSettings,
  setDiagnostics,
  showNotification,
  clearNotification,
} = editorSlice.actions;

export default editorSlice.reducer;
