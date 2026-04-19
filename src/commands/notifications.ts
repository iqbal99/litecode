import type { AppNotification } from "../types";
import type { AppDispatch } from "../store/store";
import { showNotification as showNotificationAction } from "../store/editorSlice";

export function showNotification(
  dispatch: AppDispatch,
  kind: AppNotification["kind"],
  message: string
): void {
  dispatch(showNotificationAction(kind, message));
}
