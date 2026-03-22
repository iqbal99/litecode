import type { AppTheme, EditorAction } from "../types";
import { saveSetting } from "./settingsService";

async function saveTheme(theme: AppTheme): Promise<void> {
  await saveSetting("theme", theme);
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
  void saveTheme(next);
}
