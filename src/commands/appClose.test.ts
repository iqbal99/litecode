import { describe, expect, it, vi } from "vitest";
import { resolveUnsavedBeforeExit } from "./appClose";
import type { EditorState, Tab } from "../types";
import type { AppDispatch } from "../store/store";
import { closeTab as closeTabAction } from "../store/editorSlice";

function createTab(id: string, isDirty: boolean): Tab {
  return {
    id,
    fileName: `${id}.txt`,
    filePath: `/tmp/${id}.txt`,
    isDirty,
    language: "plaintext",
    modelUri: `file:///tmp/${id}.txt`,
    cursorPosition: { lineNumber: 1, column: 1 },
    scrollPosition: { scrollTop: 0, scrollLeft: 0 },
  };
}

function createState(tabs: Tab[]): EditorState {
  return {
    tabs,
    activeTabId: tabs[0]?.id ?? null,
    theme: "vs-dark",
    fontSize: 14,
    wordWrap: "off",
    minimap: true,
    recentFiles: [],
    settings: {
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
    },
    isSettingsOpen: false,
    diagnostics: true,
    notifications: [],
    notificationSeq: 0,
  };
}

describe("resolveUnsavedBeforeExit", () => {
  it("returns true when no dirty tabs exist", async () => {
    const state = createState([createTab("a", false)]);
    const closeTabFn = vi.fn();
    const dispatch = vi.fn() as unknown as AppDispatch;

    const ok = await resolveUnsavedBeforeExit(() => state, dispatch, closeTabFn);

    expect(ok).toBe(true);
    expect(closeTabFn).not.toHaveBeenCalled();
  });

  it("closes all dirty tabs until none remain", async () => {
    const tabs = [createTab("a", true), createTab("b", true), createTab("c", false)];
    const state = createState(tabs);
    const dispatch = vi.fn((action: ReturnType<typeof closeTabAction>) => {
      if (action.type === closeTabAction.type) {
        state.tabs = state.tabs.filter((tab) => tab.id !== action.payload);
      }
    }) as unknown as AppDispatch;
    const closeTabFn = vi.fn(async (tab: Tab, d: AppDispatch) => {
      d(closeTabAction(tab.id));
      return true;
    });

    const ok = await resolveUnsavedBeforeExit(() => state, dispatch, closeTabFn);

    expect(ok).toBe(true);
    expect(closeTabFn).toHaveBeenCalledTimes(2);
    expect(state.tabs.every((tab) => !tab.isDirty)).toBe(true);
  });

  it("returns false when closing a dirty tab is cancelled", async () => {
    const state = createState([createTab("a", true), createTab("b", true)]);
    const dispatch = vi.fn() as unknown as AppDispatch;
    const closeTabFn = vi.fn(async () => false);

    const ok = await resolveUnsavedBeforeExit(() => state, dispatch, closeTabFn);

    expect(ok).toBe(false);
    expect(closeTabFn).toHaveBeenCalledTimes(1);
  });

  it("returns false when closeTabFn reports success but tab remains dirty", async () => {
    const state = createState([createTab("a", true)]);
    const dispatch = vi.fn() as unknown as AppDispatch;
    // Returns true without mutating state — simulates a buggy closeTabFn.
    const closeTabFn = vi.fn(async () => true);

    const ok = await resolveUnsavedBeforeExit(() => state, dispatch, closeTabFn);

    expect(ok).toBe(false);
    expect(closeTabFn).toHaveBeenCalledTimes(1);
  });

  it("returns false when closeTabFn throws", async () => {
    const state = createState([createTab("a", true)]);
    const dispatch = vi.fn() as unknown as AppDispatch;
    const closeTabFn = vi.fn(async () => {
      throw new Error("kaboom");
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const ok = await resolveUnsavedBeforeExit(() => state, dispatch, closeTabFn);

    expect(ok).toBe(false);
    expect(closeTabFn).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("skips dirty settings tabs", async () => {
    const settingsTab: Tab = {
      ...createTab("settings", true),
      isSettings: true,
    };
    const state = createState([settingsTab, createTab("a", false)]);
    const dispatch = vi.fn() as unknown as AppDispatch;
    const closeTabFn = vi.fn(async () => true);

    const ok = await resolveUnsavedBeforeExit(() => state, dispatch, closeTabFn);

    expect(ok).toBe(true);
    expect(closeTabFn).not.toHaveBeenCalled();
  });
});
