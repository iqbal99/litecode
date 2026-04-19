import type { AppTheme } from "../types";
import type { AppDispatch } from "../store/store";
import { setTheme } from "../store/editorSlice";
import { saveSetting } from "./settingsService";
import { showNotification } from "./notifications";

async function saveTheme(theme: AppTheme, dispatch: AppDispatch): Promise<void> {
  const ok = await saveSetting("theme", theme);
  if (!ok) {
    showNotification(
      dispatch,
      "warning",
      "LiteCode could not persist the theme preference."
    );
  }
}

export function cycleTheme(current: AppTheme, dispatch: AppDispatch): void {
  const themes: AppTheme[] = ["vs-dark", "vs", "hc-black"];
  const idx = themes.indexOf(current);
  const next = themes[(idx + 1) % themes.length];
  dispatch(setTheme(next));
  void saveTheme(next, dispatch);
}
