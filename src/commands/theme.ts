import { load } from "@tauri-apps/plugin-store";
import type { AppTheme, EditorAction } from "../types";

const STORE_NAME = "litecode-settings.json";
const THEME_KEY = "theme";

/**
 * Load persisted theme from store, or return default.
 */
export async function loadTheme(): Promise<AppTheme> {
  try {
    const store = await load(STORE_NAME, { defaults: {}, autoSave: true });
    const theme = await store.get<AppTheme>(THEME_KEY);
    return theme ?? "vs-dark";
  } catch {
    return "vs-dark";
  }
}

/**
 * Save theme preference to store.
 */
export async function saveTheme(theme: AppTheme): Promise<void> {
  try {
    const store = await load(STORE_NAME, { defaults: {}, autoSave: true });
    await store.set(THEME_KEY, theme);
  } catch (err) {
    console.error("Failed to save theme:", err);
  }
}

/**
 * Cycle through themes: vs-dark → vs → hc-black → vs-dark
 */
export function cycleTheme(
  current: AppTheme,
  dispatch: React.Dispatch<EditorAction>
): void {
  const themes: AppTheme[] = ["vs-dark", "vs", "hc-black"];
  const idx = themes.indexOf(current);
  const next = themes[(idx + 1) % themes.length];
  dispatch({ type: "SET_THEME", theme: next });
  saveTheme(next);
}

/**
 * Load all persisted settings.
 */
export async function loadSettings(): Promise<{
  theme: AppTheme;
  fontSize: number;
  wordWrap: "off" | "on";
  minimap: boolean;
}> {
  try {
    const store = await load(STORE_NAME, { defaults: {}, autoSave: true });
    const theme = (await store.get<AppTheme>("theme")) ?? "vs-dark";
    const fontSize = (await store.get<number>("fontSize")) ?? 14;
    const wordWrap =
      (await store.get<"off" | "on">("wordWrap")) ?? "off";
    const minimap = (await store.get<boolean>("minimap")) ?? true;
    return { theme, fontSize, wordWrap, minimap };
  } catch {
    return { theme: "vs-dark", fontSize: 14, wordWrap: "off", minimap: true };
  }
}

/**
 * Save a specific setting.
 */
export async function saveSetting(
  key: string,
  value: unknown
): Promise<void> {
  try {
    const store = await load(STORE_NAME, { defaults: {}, autoSave: true });
    await store.set(key, value);
  } catch (err) {
    console.error(`Failed to save setting ${key}:`, err);
  }
}
