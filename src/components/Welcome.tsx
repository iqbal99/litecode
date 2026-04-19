import { useCallback } from "react";
import { exists } from "@tauri-apps/plugin-fs";
import { FilePlus, FolderOpen, Clock, Trash2 } from "lucide-react";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import { setRecentFiles } from "../store/editorSlice";
import { newFile, openFile, openFilePath } from "../commands/fileOps";
import { clearRecentFiles, saveRecentFiles } from "../store/recentFiles";
import { sc } from "../utils/platform";

export default function Welcome() {
  const recentFiles = useAppSelector((s) => s.editor.recentFiles);
  const dispatch = useAppDispatch();

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
        // Only prune the entry if exists() definitively reports missing.
        // On I/O errors, leave the entry alone so a transient failure does
        // not destroy history.
        let missing = false;
        try {
          missing = !(await exists(path));
        } catch {
          missing = false;
        }
        if (missing) {
          const nextRecent = recentFiles.filter((entry) => entry !== path);
          dispatch(setRecentFiles(nextRecent));
          await saveRecentFiles(nextRecent);
        }
      }
    },
    [dispatch, recentFiles]
  );

  const handleClearRecent = useCallback(async () => {
    await clearRecentFiles();
    dispatch(setRecentFiles([]));
  }, [dispatch]);

  const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
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

        {recentFiles.length > 0 && (
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
              {recentFiles.map((path) => (
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
