import { describe, expect, it } from "vitest";
import editorReducer, { initialState, openTab, closeTab, openSettings, closeSettings } from "./editorSlice";
import { SETTINGS_TAB_ID } from "../types";

function createFileTab(id: string, filePath: string) {
  return {
    id,
    filePath,
    fileName: filePath.split("/").pop() ?? filePath,
    isDirty: false,
    language: "plaintext",
    modelUri: `file://${filePath}`,
    cursorPosition: { lineNumber: 1, column: 1 },
    scrollPosition: { scrollTop: 0, scrollLeft: 0 },
  };
}

describe("editorReducer", () => {
  it("reuses existing tab when opening same file path", () => {
    const existing = createFileTab("a", "/tmp/example.txt");
    const state = {
      ...initialState,
      tabs: [existing],
      activeTabId: existing.id,
    };

    const next = editorReducer(state, openTab(createFileTab("new-id", "/tmp/example.txt")));

    expect(next.tabs).toHaveLength(1);
    expect(next.activeTabId).toBe(existing.id);
  });

  it("opens and closes settings tab consistently", () => {
    const state = editorReducer(initialState, openSettings());
    expect(state.isSettingsOpen).toBe(true);
    expect(state.activeTabId).toBe(SETTINGS_TAB_ID);
    expect(state.tabs.some((tab) => tab.isSettings)).toBe(true);

    const closed = editorReducer(state, closeSettings());
    expect(closed.isSettingsOpen).toBe(false);
    expect(closed.tabs.some((tab) => tab.isSettings)).toBe(false);
    expect(closed.activeTabId).toBe(null);
  });

  it("moves focus to a neighboring tab after close", () => {
    const tabA = createFileTab("a", "/tmp/a.txt");
    const tabB = createFileTab("b", "/tmp/b.txt");
    const state = {
      ...initialState,
      tabs: [tabA, tabB],
      activeTabId: tabA.id,
    };

    const next = editorReducer(state, closeTab(tabA.id));
    expect(next.tabs).toHaveLength(1);
    expect(next.activeTabId).toBe(tabB.id);
  });
});
