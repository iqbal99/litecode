import { useRef, useState, useCallback, useEffect } from "react";
import { useEditor } from "../store/editorStore";
import { closeTab, saveFile, saveFileAs } from "../commands/fileOps";

export default function TabBar() {
  const { state, dispatch } = useEditor();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleTabClick = useCallback(
    (tabId: string) => {
      dispatch({ type: "SET_ACTIVE_TAB", tabId });
    },
    [dispatch]
  );

  const handleClose = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return;
      if (tab.isSettings) {
        dispatch({ type: "CLOSE_SETTINGS" });
      } else {
        closeTab(tab, dispatch);
      }
    },
    [state, dispatch]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      const tab = state.tabs.find((t) => t.id === tabId);
      // No context menu for the settings tab
      if (tab?.isSettings) return;
      setContextMenu({ x: e.clientX, y: e.clientY, tabId });
    },
    [state]
  );

  const handleCloseOthers = useCallback(
    async (tabId: string) => {
      const others = state.tabs.filter((t) => t.id !== tabId && !t.isSettings);
      for (const tab of others) {
        await closeTab(tab, dispatch);
      }
      setContextMenu(null);
    },
    [state, dispatch]
  );

  const handleCloseAll = useCallback(async () => {
    for (const tab of [...state.tabs]) {
      if (tab.isSettings) {
        dispatch({ type: "CLOSE_SETTINGS" });
      } else {
        await closeTab(tab, dispatch);
      }
    }
    setContextMenu(null);
  }, [state, dispatch]);

  const handleCloseSaved = useCallback(async () => {
    const saved = state.tabs.filter((t) => !t.isDirty && !t.isSettings);
    for (const tab of saved) {
      await closeTab(tab, dispatch);
    }
    setContextMenu(null);
  }, [state, dispatch]);

  const handleSave = useCallback(
    async (tabId: string) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (tab) {
        if (tab.filePath) {
          await saveFile(tab, dispatch);
        } else {
          await saveFileAs(tab, dispatch);
        }
      }
      setContextMenu(null);
    },
    [state, dispatch]
  );

  // Middle-click to close
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button === 1) {
        e.preventDefault();
        const tab = state.tabs.find((t) => t.id === tabId);
        if (!tab) return;
        if (tab.isSettings) {
          dispatch({ type: "CLOSE_SETTINGS" });
        } else {
          closeTab(tab, dispatch);
        }
      }
    },
    [state, dispatch]
  );

  // Horizontal scroll with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (tabsRef.current) {
      tabsRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // Scroll the active tab into view whenever the active tab changes
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeEl = tabsRef.current.querySelector(".tab.active") as HTMLElement | null;
    activeEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [state.activeTabId]);

  // Close context menu on outside click
  const handleOverlayClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  if (state.tabs.length === 0) return null;

  return (
    <>
      <div className="tab-bar" ref={tabsRef} onWheel={handleWheel}>
        {state.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === state.activeTabId ? "active" : ""} ${
              tab.isDirty ? "dirty" : ""
            }${tab.isSettings ? " tab-settings" : ""}`}
            onClick={() => handleTabClick(tab.id)}
            onMouseDown={(e) => handleMouseDown(e, tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            title={tab.isSettings ? "Settings" : (tab.filePath ?? tab.fileName)}
          >
            <span className="tab-name">{tab.fileName}</span>
            {tab.isDirty && !tab.isSettings && <span className="tab-dirty-dot">●</span>}
            <button
              className="tab-close"
              onClick={(e) => handleClose(e, tab.id)}
              title="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {contextMenu && (
        <div className="context-overlay" onClick={handleOverlayClick}>
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => handleSave(contextMenu.tabId)}>Save</button>
            <button
              onClick={() => {
                const tab = state.tabs.find((t) => t.id === contextMenu.tabId);
                if (tab) closeTab(tab, dispatch);
                setContextMenu(null);
              }}
            >
              Close
            </button>
            <button onClick={() => handleCloseOthers(contextMenu.tabId)}>
              Close Others
            </button>
            <button onClick={handleCloseSaved}>Close Saved</button>
            <button onClick={handleCloseAll}>Close All</button>
          </div>
        </div>
      )}
    </>
  );
}
