import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Tauri FS so we can simulate a shared on-disk buffer and assert
// that concurrent saves go through the serialization queue.
const fsState = {
  buffer: null as string | null,
  readCalls: 0,
  writeCalls: 0,
};

vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: { Home: "Home" },
  mkdir: vi.fn(async () => undefined),
  readTextFile: vi.fn(async () => {
    fsState.readCalls += 1;
    if (fsState.buffer == null) throw new Error("ENOENT");
    // Yield so we can observe interleaving if the queue is broken.
    await new Promise((r) => setTimeout(r, 0));
    return fsState.buffer;
  }),
  writeTextFile: vi.fn(async (_file: string, contents: string) => {
    fsState.writeCalls += 1;
    await new Promise((r) => setTimeout(r, 0));
    fsState.buffer = contents;
  }),
}));

import {
  DEFAULT_PERSISTED_SETTINGS,
  sanitizePersistedSettings,
  saveSetting,
  loadSettings,
} from "./settingsService";

describe("sanitizePersistedSettings", () => {
  it("returns defaults for non-object input", () => {
    expect(sanitizePersistedSettings(null)).toEqual(DEFAULT_PERSISTED_SETTINGS);
    expect(sanitizePersistedSettings("bad-json-shape")).toEqual(DEFAULT_PERSISTED_SETTINGS);
  });

  it("preserves valid settings values", () => {
    const result = sanitizePersistedSettings({
      ...DEFAULT_PERSISTED_SETTINGS,
      theme: "vs",
      fontSize: 18,
      tabSize: 4,
      lineNumbers: "relative",
      autoClosingBrackets: "languageDefined",
      snippetSuggestions: "top",
    });

    expect(result.theme).toBe("vs");
    expect(result.fontSize).toBe(18);
    expect(result.tabSize).toBe(4);
    expect(result.lineNumbers).toBe("relative");
    expect(result.autoClosingBrackets).toBe("languageDefined");
    expect(result.snippetSuggestions).toBe("top");
  });

  it("coerces invalid values back to safe defaults", () => {
    const result = sanitizePersistedSettings({
      theme: "invalid-theme",
      fontSize: 999,
      tabSize: 0,
      lineNumbers: "bad",
      minimap: "yes",
      quickSuggestions: 1,
      autoSurround: "sometimes",
    });

    expect(result.theme).toBe(DEFAULT_PERSISTED_SETTINGS.theme);
    expect(result.fontSize).toBe(72);
    expect(result.tabSize).toBe(1);
    expect(result.lineNumbers).toBe(DEFAULT_PERSISTED_SETTINGS.lineNumbers);
    expect(result.minimap).toBe(DEFAULT_PERSISTED_SETTINGS.minimap);
    expect(result.quickSuggestions).toBe(DEFAULT_PERSISTED_SETTINGS.quickSuggestions);
    expect(result.autoSurround).toBe(DEFAULT_PERSISTED_SETTINGS.autoSurround);
  });
});

describe("saveSetting serialization", () => {
  beforeEach(() => {
    fsState.buffer = JSON.stringify(DEFAULT_PERSISTED_SETTINGS);
    fsState.readCalls = 0;
    fsState.writeCalls = 0;
  });

  it("does not lose concurrent updates to different keys", async () => {
    await Promise.all([
      saveSetting("fontSize", 20),
      saveSetting("tabSize", 8),
      saveSetting("theme", "vs"),
    ]);

    const final = await loadSettings();
    expect(final.fontSize).toBe(20);
    expect(final.tabSize).toBe(8);
    expect(final.theme).toBe("vs");
  });

  it("serializes writes so the last call wins on the same key", async () => {
    await Promise.all([
      saveSetting("fontSize", 10),
      saveSetting("fontSize", 22),
    ]);
    const final = await loadSettings();
    expect(final.fontSize).toBe(22);
  });

  it("returns true on success and false on write failure", async () => {
    const ok = await saveSetting("fontSize", 16);
    expect(ok).toBe(true);
  });
});
