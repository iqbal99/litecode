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

export async function loadSettings(): Promise<PersistedSettings> {
  try {
    await ensureSettingsDir();
    const raw = await readTextFile(SETTINGS_FILE, { baseDir: BASE });
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULT_PERSISTED_SETTINGS };
    }
    // Deep-merge: any missing key falls back to the default
    return { ...DEFAULT_PERSISTED_SETTINGS, ...parsed };
  } catch {
    // File doesn't exist or is invalid — return defaults
    return { ...DEFAULT_PERSISTED_SETTINGS };
  }
}

// ─── Save settings to ~/.litecode/settings.json ─────────────────────────────

export async function saveSettings(settings: PersistedSettings): Promise<void> {
  try {
    await ensureSettingsDir();
    await writeTextFile(
      SETTINGS_FILE,
      JSON.stringify(settings, null, 2),
      { baseDir: BASE }
    );
  } catch (err) {
    console.error("[settingsService] Failed to save settings:", err);
  }
}

// ─── Save a single setting key (read-modify-write) ──────────────────────────

export async function saveSetting<K extends keyof PersistedSettings>(
  key: K,
  value: PersistedSettings[K]
): Promise<void> {
  try {
    const current = await loadSettings();
    await saveSettings({ ...current, [key]: value });
  } catch (err) {
    console.error(`[settingsService] Failed to save setting ${key}:`, err);
  }
}
