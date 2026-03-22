import { useCallback } from "react";
import { exists } from "@tauri-apps/plugin-fs";
import { FilePlus, FolderOpen, Clock, Trash2 } from "lucide-react";
import { useEditor } from "../store/editorStore";
import { newFile, openFile, openFilePath } from "../commands/fileOps";
import { clearRecentFiles, saveRecentFiles } from "../store/recentFiles";
import { sc } from "../utils/platform";

export default function Welcome() {
  const { state, dispatch } = useEditor();

  const handleNew = useCallback(() => {
    newFile(dispatch);
  }, [dispatch]);

  const handleOpen = useCallback(() => {
    openFile(dispatch);
  }, [dispatch]);

  const handleOpenRecent = useCallback(
    async (path: string) => {
      const opened = await openFilePath(path, dispatch);
      if (!opened) {
        const missing = !(await exists(path).catch(() => true));
        if (missing) {
          const nextRecent = state.recentFiles.filter((entry) => entry !== path);
          dispatch({ type: "SET_RECENT_FILES", recentFiles: nextRecent });
          await saveRecentFiles(nextRecent);
        }
      }
    },
    [dispatch, state.recentFiles]
  );

  const handleClearRecent = useCallback(async () => {
    await clearRecentFiles();
    dispatch({ type: "SET_RECENT_FILES", recentFiles: [] });
  }, [dispatch]);

  // Extract just the filename from a path (handles both / and \)
  const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
  // Extract directory portion
  const dirName = (path: string) => {
    const parts = path.split(/[\\/]/);
    parts.pop();
    return parts.join("/") || "/";
  };

  return (
    <div className="welcome">
      <div className="welcome-content">
        <h1 className="welcome-title">LiteCode</h1>
        <p className="welcome-subtitle">A lightweight code editor</p>

        <div className="welcome-actions">
          <button className="welcome-btn" onClick={handleNew}>
            <span className="welcome-btn-icon"><FilePlus size={18} /></span>
            New File
            <span className="welcome-shortcut">{sc("⌘N", "Ctrl+N")}</span>
          </button>
          <button className="welcome-btn" onClick={handleOpen}>
            <span className="welcome-btn-icon"><FolderOpen size={18} /></span>
            Open File
            <span className="welcome-shortcut">{sc("⌘O", "Ctrl+O")}</span>
          </button>
        </div>

        {state.recentFiles.length > 0 && (
          <div className="welcome-recent">
            <div className="welcome-recent-header">
              <h2><Clock size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Recent Files</h2>
              <button
                className="welcome-clear-btn"
                onClick={handleClearRecent}
                title="Clear recent files"
              >
                <Trash2 size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                Clear
              </button>
            </div>
            <ul className="welcome-recent-list">
              {state.recentFiles.map((path) => (
                <li key={path}>
                  <button
                    className="welcome-recent-item"
                    onClick={() => handleOpenRecent(path)}
                    title={path}
                  >
                    <span className="recent-filename">{fileName(path)}</span>
                    <span className="recent-path">{dirName(path)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="welcome-footer">
          <p>
            <kbd>{sc("⌘P", "Ctrl+P")}</kbd> Command Palette &nbsp;·&nbsp;{" "}
            <kbd>{sc("⌘S", "Ctrl+S")}</kbd> Save &nbsp;·&nbsp;{" "}
            <kbd>{sc("⌘W", "Ctrl+W")}</kbd> Close Tab
          </p>
        </div>
      </div>
    </div>
  );
}
