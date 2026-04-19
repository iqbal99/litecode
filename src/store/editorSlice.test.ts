import { describe, expect, it } from "vitest";
import editorReducer, {
  initialState,
  showNotification,
  clearNotification,
  updateSetting,
  openTab,
  closeTab,
  openSettings,
  closeSettings,
  setActiveTab,
} from "./editorSlice";
import { SETTINGS_TAB_ID } from "../types";

function fileTab(id: string, filePath: string | null = `/tmp/${id}.txt`) {
  return {
    id,
    filePath,
    fileName: filePath ? filePath.split("/").pop()! : id,
    isDirty: false,
    language: "plaintext",
    modelUri: filePath ? `file://${filePath}` : `inmemory://${id}`,
    cursorPosition: { lineNumber: 1, column: 1 },
    scrollPosition: { scrollTop: 0, scrollLeft: 0 },
  };
}

describe("showNotification", () => {
  it("assigns strictly monotonic ids via notificationSeq", () => {
    let state = editorReducer(initialState, showNotification("info", "one"));
    state = editorReducer(state, showNotification("warning", "two"));
    state = editorReducer(state, showNotification("error", "three"));

    expect(state.notifications.map((n) => n.id)).toEqual([1, 2, 3]);
    expect(state.notifications.map((n) => n.kind)).toEqual([
      "info",
      "warning",
      "error",
    ]);
    expect(state.notificationSeq).toBe(3);
  });

  it("caps stored notifications at 5 but keeps ids unique", () => {
    let state = initialState;
    for (let i = 0; i < 8; i++) {
      state = editorReducer(state, showNotification("info", `n${i}`));
    }
    expect(state.notifications).toHaveLength(5);
    const ids = state.notifications.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Keep the most recent ones.
    expect(ids).toEqual([4, 5, 6, 7, 8]);
  });

  it("clearNotification removes by id", () => {
    let state = editorReducer(initialState, showNotification("info", "one"));
    state = editorReducer(state, showNotification("info", "two"));
    state = editorReducer(state, clearNotification(1));
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].id).toBe(2);
  });
});

describe("updateSetting", () => {
  it("accepts typed positional args and updates the right key", () => {
    const state = editorReducer(initialState, updateSetting("tabSize", 4));
    expect(state.settings.tabSize).toBe(4);
  });

  it("does not mutate unrelated keys", () => {
    const state = editorReducer(
      initialState,
      updateSetting("fontFamily", "Fira Code")
    );
    expect(state.settings.fontFamily).toBe("Fira Code");
    expect(state.settings.tabSize).toBe(initialState.settings.tabSize);
  });
});

describe("closeTab", () => {
  it("selects neighbor when closing a middle tab", () => {
    const a = fileTab("a", "/tmp/a.txt");
    const b = fileTab("b", "/tmp/b.txt");
    const c = fileTab("c", "/tmp/c.txt");
    const state = { ...initialState, tabs: [a, b, c], activeTabId: b.id };
    const next = editorReducer(state, closeTab(b.id));
    expect(next.tabs.map((t) => t.id)).toEqual(["a", "c"]);
    // Closing the middle tab should advance to the next sibling at the same index.
    expect(next.activeTabId).toBe("c");
  });

  it("falls back to last when closing the rightmost tab", () => {
    const a = fileTab("a", "/tmp/a.txt");
    const b = fileTab("b", "/tmp/b.txt");
    const state = { ...initialState, tabs: [a, b], activeTabId: b.id };
    const next = editorReducer(state, closeTab(b.id));
    expect(next.activeTabId).toBe("a");
  });

  it("clears active when closing the only tab", () => {
    const a = fileTab("a", "/tmp/a.txt");
    const state = { ...initialState, tabs: [a], activeTabId: a.id };
    const next = editorReducer(state, closeTab(a.id));
    expect(next.tabs).toHaveLength(0);
    expect(next.activeTabId).toBeNull();
  });

  it("keeps active tab when closing a background tab", () => {
    const a = fileTab("a", "/tmp/a.txt");
    const b = fileTab("b", "/tmp/b.txt");
    const state = { ...initialState, tabs: [a, b], activeTabId: a.id };
    const next = editorReducer(state, closeTab(b.id));
    expect(next.activeTabId).toBe("a");
  });
});

describe("settings tab", () => {
  it("open/close of settings updates isSettingsOpen", () => {
    let state = editorReducer(initialState, openSettings());
    expect(state.isSettingsOpen).toBe(true);
    expect(state.tabs.some((t) => t.isSettings)).toBe(true);

    state = editorReducer(state, closeSettings());
    expect(state.isSettingsOpen).toBe(false);
    expect(state.tabs.some((t) => t.isSettings)).toBe(false);
  });

  it("closing the settings tab via closeTab also clears isSettingsOpen", () => {
    const state = editorReducer(initialState, openSettings());
    const next = editorReducer(state, closeTab(SETTINGS_TAB_ID));
    expect(next.isSettingsOpen).toBe(false);
  });
});

describe("openTab + setActiveTab", () => {
  it("dedupes by filePath and activates existing tab", () => {
    const state = {
      ...initialState,
      tabs: [fileTab("a", "/tmp/x.txt")],
      activeTabId: "a",
    };
    const next = editorReducer(
      state,
      openTab(fileTab("new-id", "/tmp/x.txt"))
    );
    expect(next.tabs).toHaveLength(1);
    expect(next.activeTabId).toBe("a");
  });

  it("setActiveTab ignores unknown ids", () => {
    const state = {
      ...initialState,
      tabs: [fileTab("a")],
      activeTabId: "a",
    };
    const next = editorReducer(state, setActiveTab("does-not-exist"));
    expect(next.activeTabId).toBe("a");
  });
});
