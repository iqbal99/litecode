import { useEditor } from "../store/editorStore";
import { X } from "lucide-react";

export default function NotificationCenter() {
  const { state, dispatch } = useEditor();

  if (state.notifications.length === 0) return null;

  return (
    <div className="notification-stack" aria-live="polite" aria-atomic="false">
      {state.notifications.map((n) => (
        <div key={n.id} className={`notification notification--${n.kind}`} role="status">
          <span className="notification-message">{n.message}</span>
          <button
            className="notification-close"
            type="button"
            onClick={() => dispatch({ type: "CLEAR_NOTIFICATION", id: n.id })}
            aria-label="Dismiss notification"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
