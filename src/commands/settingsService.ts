import {
  readTextFile,
  writeTextFile,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/plugin-fs";
import type { AppTheme, EditorSettings } from "../types";
import { DEFAULT_EDITOR_SETTINGS } from "../types";

// ─── Full persisted settings shape ──────────────────────────────────────────

export interface PersistedSettings extends EditorSettings {
  theme: AppTheme;
  fontSize: number;
  wordWrap: "off" | "on";
  minimap: boolean;
  diagnostics: boolean;
}

export const DEFAULT_PERSISTED_SETTINGS: PersistedSettings = {
  ...DEFAULT_EDITOR_SETTINGS,
  theme: "vs-dark",
  fontSize: 14,
  wordWrap: "off",
  minimap: true,
  diagnostics: true,
};

const SETTINGS_DIR = ".litecode";
const SETTINGS_FILE = ".litecode/settings.json";
const BASE = BaseDirectory.Home;

const THEME_VALUES: ReadonlySet<AppTheme> = new Set(["vs-dark", "vs", "hc-black"]);
const WORD_WRAP_VALUES: ReadonlySet<"off" | "on"> = new Set(["off", "on"]);
const RENDER_WHITESPACE_VALUES: ReadonlySet<EditorSettings["renderWhitespace"]> = new Set([
  "none",
  "boundary",
  "selection",
  "trailing",
  "all",
]);
const LINE_NUMBER_VALUES: ReadonlySet<EditorSettings["lineNumbers"]> = new Set([
  "on",
  "off",
  "relative",
]);
const MINIMAP_SIDE_VALUES: ReadonlySet<EditorSettings["minimapSide"]> = new Set(["left", "right"]);
const CURSOR_BLINKING_VALUES: ReadonlySet<EditorSettings["cursorBlinking"]> = new Set([
  "blink",
  "smooth",
  "phase",
  "expand",
  "solid",
]);
const CURSOR_STYLE_VALUES: ReadonlySet<EditorSettings["cursorStyle"]> = new Set([
  "line",
  "block",
  "underline",
  "line-thin",
  "block-outline",
  "underline-thin",
]);
const AUTO_CLOSING_VALUES: ReadonlySet<EditorSettings["autoClosingBrackets"]> = new Set([
  "always",
  "languageDefined",
  "beforeWhitespace",
  "never",
]);
const ACCEPT_SUGGESTION_VALUES: ReadonlySet<EditorSettings["acceptSuggestionOnEnter"]> = new Set([
  "on",
  "off",
  "smart",
]);
const TAB_COMPLETION_VALUES: ReadonlySet<EditorSettings["tabCompletion"]> = new Set([
  "on",
  "off",
  "onlySnippets",
]);
const SNIPPET_SUGGESTION_VALUES: ReadonlySet<EditorSettings["snippetSuggestions"]> = new Set([
  "top",
  "bottom",
  "inline",
  "none",
]);
const MATCH_BRACKETS_VALUES: ReadonlySet<EditorSettings["matchBrackets"]> = new Set([
  "always",
  "near",
  "never",
]);
const AUTO_SURROUND_VALUES: ReadonlySet<EditorSettings["autoSurround"]> = new Set([
  "languageDefined",
  "brackets",
  "quotes",
  "never",
]);

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pickEnumValue<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  fallback: T
): T {
  if (typeof value === "string" && allowed.has(value as T)) {
    return value as T;
  }
  return fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = asFiniteNumber(value);
  if (parsed === null) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function sanitizePersistedSettings(raw: unknown): PersistedSettings {
  const parsed = asObject(raw);
  if (!parsed) {
    return { ...DEFAULT_PERSISTED_SETTINGS };
  }

  const defaults = DEFAULT_PERSISTED_SETTINGS;

  return {
    theme: pickEnumValue(parsed.theme, THEME_VALUES, defaults.theme),
    fontSize: clampNumber(parsed.fontSize, defaults.fontSize, 8, 72),
    wordWrap: pickEnumValue(parsed.wordWrap, WORD_WRAP_VALUES, defaults.wordWrap),
    minimap: asBoolean(parsed.minimap) ?? defaults.minimap,
    diagnostics: asBoolean(parsed.diagnostics) ?? defaults.diagnostics,

    fontFamily: asString(parsed.fontFamily) ?? defaults.fontFamily,
    lineHeight: clampNumber(parsed.lineHeight, defaults.lineHeight, 0, 120),
    fontLigatures: asBoolean(parsed.fontLigatures) ?? defaults.fontLigatures,

    wordWrapColumn: clampNumber(parsed.wordWrapColumn, defaults.wordWrapColumn, 1, 240),
    tabSize: clampNumber(parsed.tabSize, defaults.tabSize, 1, 12),
    insertSpaces: asBoolean(parsed.insertSpaces) ?? defaults.insertSpaces,
    detectIndentation: asBoolean(parsed.detectIndentation) ?? defaults.detectIndentation,

    renderWhitespace: pickEnumValue(
      parsed.renderWhitespace,
      RENDER_WHITESPACE_VALUES,
      defaults.renderWhitespace
    ),
    lineNumbers: pickEnumValue(parsed.lineNumbers, LINE_NUMBER_VALUES, defaults.lineNumbers),
    minimapSide: pickEnumValue(parsed.minimapSide, MINIMAP_SIDE_VALUES, defaults.minimapSide),

    cursorBlinking: pickEnumValue(
      parsed.cursorBlinking,
      CURSOR_BLINKING_VALUES,
      defaults.cursorBlinking
    ),
    cursorStyle: pickEnumValue(parsed.cursorStyle, CURSOR_STYLE_VALUES, defaults.cursorStyle),

    smoothScrolling: asBoolean(parsed.smoothScrolling) ?? defaults.smoothScrolling,
    mouseWheelZoom: asBoolean(parsed.mouseWheelZoom) ?? defaults.mouseWheelZoom,
    scrollBeyondLastLine: asBoolean(parsed.scrollBeyondLastLine) ?? defaults.scrollBeyondLastLine,

    formatOnPaste: asBoolean(parsed.formatOnPaste) ?? defaults.formatOnPaste,
    formatOnType: asBoolean(parsed.formatOnType) ?? defaults.formatOnType,

    autoClosingBrackets: pickEnumValue(
      parsed.autoClosingBrackets,
      AUTO_CLOSING_VALUES,
      defaults.autoClosingBrackets
    ),
    autoClosingQuotes: pickEnumValue(
      parsed.autoClosingQuotes,
      AUTO_CLOSING_VALUES,
      defaults.autoClosingQuotes
    ),
    bracketPairColorization:
      asBoolean(parsed.bracketPairColorization) ?? defaults.bracketPairColorization,
    showBracketGuides: asBoolean(parsed.showBracketGuides) ?? defaults.showBracketGuides,
    folding: asBoolean(parsed.folding) ?? defaults.folding,
    links: asBoolean(parsed.links) ?? defaults.links,

    quickSuggestions: asBoolean(parsed.quickSuggestions) ?? defaults.quickSuggestions,
    parameterHints: asBoolean(parsed.parameterHints) ?? defaults.parameterHints,
    acceptSuggestionOnEnter: pickEnumValue(
      parsed.acceptSuggestionOnEnter,
      ACCEPT_SUGGESTION_VALUES,
      defaults.acceptSuggestionOnEnter
    ),
    tabCompletion: pickEnumValue(parsed.tabCompletion, TAB_COMPLETION_VALUES, defaults.tabCompletion),
    snippetSuggestions: pickEnumValue(
      parsed.snippetSuggestions,
      SNIPPET_SUGGESTION_VALUES,
      defaults.snippetSuggestions
    ),
    matchBrackets: pickEnumValue(parsed.matchBrackets, MATCH_BRACKETS_VALUES, defaults.matchBrackets),
    autoSurround: pickEnumValue(parsed.autoSurround, AUTO_SURROUND_VALUES, defaults.autoSurround),
  };
}

// ─── Ensure ~/.litecode exists ───────────────────────────────────────────────

async function ensureSettingsDir(): Promise<void> {
  try {
    await mkdir(SETTINGS_DIR, { baseDir: BASE, recursive: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("already exist") && !msg.includes("EEXIST")) {
      console.error("[settingsService] Failed to create settings directory:", msg);
    }
  }
}

// ─── Load settings from ~/.litecode/settings.json ───────────────────────────

async function loadSettingsImpl(): Promise<PersistedSettings> {
  try {
    await ensureSettingsDir();
    const raw = await readTextFile(SETTINGS_FILE, { baseDir: BASE });
    const parsed = JSON.parse(raw) as unknown;
    return sanitizePersistedSettings(parsed);
  } catch {
    // File doesn't exist or is invalid — return defaults
    return { ...DEFAULT_PERSISTED_SETTINGS };
  }
}

export async function loadSettings(): Promise<PersistedSettings> {
  // Run reads through the write queue so load-after-save returns the freshest value.
  return enqueue(() => loadSettingsImpl());
}

// ─── Save queue (serialize read-modify-write) ───────────────────────────────

let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task, task);
  // Keep the chain alive without leaking rejections.
  writeQueue = next.catch(() => undefined);
  return next;
}

// ─── Save settings to ~/.litecode/settings.json ─────────────────────────────

async function writeSettingsToDisk(settings: PersistedSettings): Promise<void> {
  await ensureSettingsDir();
  const safeSettings = sanitizePersistedSettings(settings);
  await writeTextFile(
    SETTINGS_FILE,
    JSON.stringify(safeSettings, null, 2),
    { baseDir: BASE }
  );
}

export async function saveSettings(settings: PersistedSettings): Promise<boolean> {
  return enqueue(async () => {
    try {
      await writeSettingsToDisk(settings);
      return true;
    } catch (err) {
      console.error("[settingsService] Failed to save settings:", err);
      return false;
    }
  });
}

// ─── Save a single setting key (read-modify-write) ──────────────────────────

export async function saveSetting<K extends keyof PersistedSettings>(
  key: K,
  value: PersistedSettings[K]
): Promise<boolean> {
  return enqueue(async () => {
    try {
      const current = await loadSettingsImpl();
      await writeSettingsToDisk({ ...current, [key]: value });
      return true;
    } catch (err) {
      console.error(`[settingsService] Failed to save setting ${key}:`, err);
      return false;
    }
  });
}
