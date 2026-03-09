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
