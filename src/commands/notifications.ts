import type { AppNotification, EditorAction } from "../types";

export function showNotification(
  dispatch: React.Dispatch<EditorAction>,
  kind: AppNotification["kind"],
  message: string
): void {
  dispatch({
    type: "SHOW_NOTIFICATION",
    notification: {
      id: Date.now() + Math.floor(Math.random() * 1000),
      kind,
      message,
    },
  });
}
