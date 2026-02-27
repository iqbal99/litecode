import { useCallback } from "react";
import { useEditor } from "../store/editorStore";
import { cycleTheme, saveSetting } from "../commands/theme";
import type { StatusInfo } from "../types";

export default function StatusBar() {
  const { state, dispatch } = useEditor();

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null;

  const info: StatusInfo = {
    language: activeTab?.language ?? "plaintext",
    lineNumber: activeTab?.cursorPosition?.lineNumber ?? 1,
    column: activeTab?.cursorPosition?.column ?? 1,
    encoding: "UTF-8",
    eol: "LF",
    indentation: `Spaces: ${state.fontSize >= 1 ? 4 : 2}`,
  };

  const handleThemeClick = useCallback(() => {
    cycleTheme(state.theme, dispatch);
  }, [state.theme, dispatch]);

  const handleWordWrapToggle = useCallback(() => {
    const next = state.wordWrap === "on" ? "off" : "on";
    dispatch({ type: "SET_WORD_WRAP", wordWrap: next as "on" | "off" });
    saveSetting("wordWrap", next);
  }, [state.wordWrap, dispatch]);

  const handleMinimapToggle = useCallback(() => {
    dispatch({ type: "SET_MINIMAP", minimap: !state.minimap });
    saveSetting("minimap", !state.minimap);
  }, [state.minimap, dispatch]);

  return (
    <div className="status-bar">
      <div className="status-left">
        {activeTab && (
          <>
            <span className="status-item">
              Ln {info.lineNumber}, Col {info.column}
            </span>
            <span className="status-item">{info.indentation}</span>
            <span className="status-item">{info.encoding}</span>
            <span className="status-item">{info.eol}</span>
          </>
        )}
      </div>
      <div className="status-right">
        {activeTab && (
          <span className="status-item status-language">{info.language}</span>
        )}
        <button
          className="status-item status-btn"
          onClick={handleWordWrapToggle}
          title="Toggle word wrap"
        >
          Wrap: {state.wordWrap === "on" ? "On" : "Off"}
        </button>
        <button
          className="status-item status-btn"
          onClick={handleMinimapToggle}
          title="Toggle minimap"
        >
          Minimap: {state.minimap ? "On" : "Off"}
        </button>
        <button
          className="status-item status-btn"
          onClick={handleThemeClick}
          title="Cycle theme"
        >
          {state.theme === "vs-dark"
            ? "Dark"
            : state.theme === "vs"
            ? "Light"
            : "HC"}
        </button>
      </div>
    </div>
  );
}
