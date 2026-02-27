import { useCallback } from "react";
import { useEditor } from "../store/editorStore";
import { newFile, openFile, openFilePath } from "../commands/fileOps";
import { clearRecentFiles } from "../store/recentFiles";

export default function Welcome() {
  const { state, dispatch } = useEditor();

  const handleNew = useCallback(() => {
    newFile(dispatch);
  }, [dispatch]);

  const handleOpen = useCallback(() => {
    openFile(dispatch);
  }, [dispatch]);

  const handleOpenRecent = useCallback(
    (path: string) => {
      openFilePath(path, dispatch);
    },
    [dispatch]
  );

  const handleClearRecent = useCallback(async () => {
    await clearRecentFiles();
    dispatch({ type: "SET_RECENT_FILES", recentFiles: [] });
  }, [dispatch]);

  // Extract just the filename from a path
  const fileName = (path: string) => path.split("/").pop() ?? path;
  // Extract directory portion
  const dirName = (path: string) => {
    const parts = path.split("/");
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
            <span className="welcome-btn-icon">📄</span>
            New File
            <span className="welcome-shortcut">⌘N</span>
          </button>
          <button className="welcome-btn" onClick={handleOpen}>
            <span className="welcome-btn-icon">📂</span>
            Open File
            <span className="welcome-shortcut">⌘O</span>
          </button>
        </div>

        {state.recentFiles.length > 0 && (
          <div className="welcome-recent">
            <div className="welcome-recent-header">
              <h2>Recent Files</h2>
              <button
                className="welcome-clear-btn"
                onClick={handleClearRecent}
                title="Clear recent files"
              >
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
            <kbd>⌘P</kbd> Command Palette &nbsp;·&nbsp;{" "}
            <kbd>⌘S</kbd> Save &nbsp;·&nbsp;{" "}
            <kbd>⌘W</kbd> Close Tab
          </p>
        </div>
      </div>
    </div>
  );
}
