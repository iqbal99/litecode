import { useRef, useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import { setActiveTab, closeSettings } from "../store/editorSlice";
import { closeTab, saveFile, saveFileAs } from "../commands/fileOps";

export default function TabBar() {
  const tabs = useAppSelector((s) => s.editor.tabs);
  const activeTabId = useAppSelector((s) => s.editor.activeTabId);
  const dispatch = useAppDispatch();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleTabClick = useCallback(
    (tabId: string) => {
      dispatch(setActiveTab(tabId));
    },
    [dispatch]
  );

  const handleClose = useCallback(
    async (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      if (tab.isSettings) {
        dispatch(closeSettings());
      } else {
        await closeTab(tab, dispatch);
      }
    },
    [tabs, dispatch]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      const tab = tabs.find((t) => t.id === tabId);
      if (tab?.isSettings) return;
      const menuW = 180;
      const menuH = 160;
      const x = Math.min(e.clientX, window.innerWidth - menuW);
      const y = Math.min(e.clientY, window.innerHeight - menuH);
      setContextMenu({ x, y, tabId });
    },
    [tabs]
  );

  const handleCloseOthers = useCallback(
    async (tabId: string) => {
      const others = tabs.filter((t) => t.id !== tabId && !t.isSettings);
      for (const tab of others) {
        const closed = await closeTab(tab, dispatch);
        if (!closed) return;
      }
      setContextMenu(null);
    },
    [tabs, dispatch]
  );

  const handleCloseAll = useCallback(async () => {
    for (const tab of [...tabs]) {
      if (tab.isSettings) {
        dispatch(closeSettings());
      } else {
        const closed = await closeTab(tab, dispatch);
        if (!closed) return;
      }
    }
    setContextMenu(null);
  }, [tabs, dispatch]);

  const handleCloseSaved = useCallback(async () => {
    const saved = tabs.filter((t) => !t.isDirty && !t.isSettings);
    for (const tab of saved) {
      const closed = await closeTab(tab, dispatch);
      if (!closed) return;
    }
    setContextMenu(null);
  }, [tabs, dispatch]);

  const handleSave = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        if (tab.filePath) {
          await saveFile(tab, dispatch);
        } else {
          await saveFileAs(tab, dispatch);
        }
      }
      setContextMenu(null);
    },
    [tabs, dispatch]
  );

  const handleMouseDown = useCallback(
    async (e: React.MouseEvent, tabId: string) => {
      if (e.button === 1) {
        e.preventDefault();
        const tab = tabs.find((t) => t.id === tabId);
        if (!tab) return;
        if (tab.isSettings) {
          dispatch(closeSettings());
        } else {
          await closeTab(tab, dispatch);
        }
      }
    },
    [tabs, dispatch]
  );

  useEffect(() => {
    // Register wheel handler non-passively so we can prevent the page from
    // also scrolling when we consume the event for horizontal tab scroll.
    const el = tabsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const before = el.scrollLeft;
      el.scrollLeft = Math.max(0, Math.min(max, before + e.deltaY));
      if (el.scrollLeft !== before) {
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!tabsRef.current) return;
    const activeEl = tabsRef.current.querySelector(".tab.active") as HTMLElement | null;
    activeEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  const handleOverlayClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  if (tabs.length === 0) return null;

  return (
    <>
      <div className="tab-bar" ref={tabsRef} role="tablist" aria-label="Open files">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTabId}
            className={`tab ${tab.id === activeTabId ? "active" : ""} ${
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
              aria-label={`Close ${tab.fileName}`}
            >
              <X size={14} strokeWidth={2} />
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
              onClick={async () => {
                const tab = tabs.find((t) => t.id === contextMenu.tabId);
                if (tab) {
                  const closed = await closeTab(tab, dispatch);
                  if (!closed) return;
                }
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
