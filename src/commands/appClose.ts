import type { EditorState, Tab } from "../types";
import type { AppDispatch } from "../store/store";

type CloseTabFn = (
  tab: Tab,
  dispatch: AppDispatch
) => Promise<boolean>;

export async function resolveUnsavedBeforeExit(
  getState: () => EditorState,
  dispatch: AppDispatch,
  closeTabFn: CloseTabFn
): Promise<boolean> {
  // Bound the loop so a buggy `closeTabFn` that returns true without
  // mutating state cannot hang the app forever.
  const maxIterations = getState().tabs.length + 1;
  for (let i = 0; i < maxIterations; i++) {
    const nextDirtyTab = getState().tabs.find(
      (tab) => !tab.isSettings && tab.isDirty
    );
    if (!nextDirtyTab) {
      return true;
    }

    let closed = false;
    try {
      closed = await closeTabFn(nextDirtyTab, dispatch);
    } catch (err) {
      console.error("resolveUnsavedBeforeExit: closeTabFn threw", err);
      return false;
    }
    if (!closed) {
      return false;
    }

    // Defensive: if the tab is still present and dirty after closeTabFn
    // reports success, stop rather than loop forever.
    const stillDirty = getState().tabs.find(
      (t) => t.id === nextDirtyTab.id && t.isDirty
    );
    if (stillDirty) {
      console.error(
        "resolveUnsavedBeforeExit: closeTabFn returned true but tab remains dirty",
        nextDirtyTab.id
      );
      return false;
    }
  }

  // One more sanity check at the limit.
  return !getState().tabs.some((t) => !t.isSettings && t.isDirty);
}
