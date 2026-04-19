import { useAppSelector, useAppDispatch } from "../store/hooks";
import { clearNotification } from "../store/editorSlice";
import { X } from "lucide-react";

export default function NotificationCenter() {
  const notifications = useAppSelector((s) => s.editor.notifications);
  const dispatch = useAppDispatch();

  if (notifications.length === 0) return null;

  return (
    <div className="notification-stack" aria-live="polite" aria-atomic="false">
      {notifications.map((n) => (
        <div key={n.id} className={`notification notification--${n.kind}`} role="status">
          <span className="notification-message">{n.message}</span>
          <button
            className="notification-close"
            type="button"
            onClick={() => dispatch(clearNotification(n.id))}
            aria-label="Dismiss notification"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
