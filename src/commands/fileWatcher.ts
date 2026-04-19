import { watch, readTextFile } from "@tauri-apps/plugin-fs";
import { confirm } from "@tauri-apps/plugin-dialog";
import * as monaco from "monaco-editor";
import type { AppDispatch } from "../store/store";
import type { Tab } from "../types";
import { markClean } from "../store/editorSlice";
import { showNotification } from "./notifications";

type UnwatchFn = () => void;

const watchers = new Map<string, UnwatchFn>();
const missingWarnings = new Set<string>();
const busyPaths = new Set<string>();

function isFileEventType(event: unknown, key: "modify" | "remove" | "create"): boolean {
  if (event == null || typeof event !== "object") return false;
  const t = (event as { type?: unknown }).type;
  if (typeof t === "string") {
    return t.toLowerCase().includes(key);
  }
  if (t != null && typeof t === "object") {
    return key in (t as Record<string, unknown>);
  }
  return false;
}

export async function watchFile(
  tab: Tab,
  getLatestTab: () => Tab | undefined,
  dispatch: AppDispatch
): Promise<void> {
  if (!tab.filePath) return;
  if (watchers.has(tab.filePath)) return;

  const filePath = tab.filePath;

  try {
    const unwatch = await watch(filePath, async (event) => {
      const kinds = Array.isArray(event) ? event : [event];
      const isModify = kinds.some((e) => isFileEventType(e, "modify"));
      const isRemove = kinds.some((e) => isFileEventType(e, "remove"));
      const isCreate = kinds.some((e) => isFileEventType(e, "create"));

      if (!isModify && !isRemove && !isCreate) return;
      if (busyPaths.has(filePath)) return;

      const latestTab = getLatestTab();
      if (!latestTab) return;

      if (isRemove) {
        if (!missingWarnings.has(filePath)) {
          missingWarnings.add(filePath);
          showNotification(
            dispatch,
            "warning",
            `"${latestTab.fileName}" was deleted or moved. The buffer stays open until you save it again.`
          );
        }
        return;
      }

      busyPaths.add(filePath);
      try {
        const content = await readTextFile(filePath);
        missingWarnings.delete(filePath);

        // Re-fetch the tab after the await; it may have changed or closed.
        const currentTab = getLatestTab();
        if (!currentTab) return;

        const model = monaco.editor.getModel(
          monaco.Uri.parse(currentTab.modelUri)
        );
        if (!model) return;

        const normalize = (s: string) => s.replace(/\r\n/g, "\n");
        if (normalize(model.getValue()) === normalize(content)) return;

        if (currentTab.isDirty) {
          const reload = await confirm(
            `"${currentTab.fileName}" has been modified externally. Reload and lose your changes?`,
            { title: "File Changed", kind: "warning" }
          );
          if (!reload) return;

          // Re-check after the dialog await.
          const postDialogTab = getLatestTab();
          if (!postDialogTab) return;
          const postModel = monaco.editor.getModel(
            monaco.Uri.parse(postDialogTab.modelUri)
          );
          if (!postModel) return;
          postModel.setValue(content);
          dispatch(markClean(postDialogTab.id));
          return;
        }

        model.setValue(content);
        dispatch(markClean(currentTab.id));
      } catch {
        if (!missingWarnings.has(filePath)) {
          missingWarnings.add(filePath);
          showNotification(
            dispatch,
            "warning",
            `LiteCode could not reload "${latestTab.fileName}" from disk.`
          );
        }
      } finally {
        busyPaths.delete(filePath);
      }
    });

    watchers.set(filePath, unwatch);
  } catch (err) {
    console.error("Failed to watch file:", filePath, err);
    showNotification(
      dispatch,
      "warning",
      `LiteCode could not watch "${tab.fileName}" for external changes.`
    );
  }
}

export function unwatchFile(filePath: string): void {
  const unwatch = watchers.get(filePath);
  if (unwatch) {
    unwatch();
    watchers.delete(filePath);
  }
  missingWarnings.delete(filePath);
  busyPaths.delete(filePath);
}

export function unwatchAll(): void {
  const paths = Array.from(watchers.keys());
  for (const filePath of paths) {
    const unwatch = watchers.get(filePath);
    if (unwatch) {
      try {
        unwatch();
      } catch (err) {
        console.error("unwatchAll: unwatch failed for", filePath, err);
      }
    }
    watchers.delete(filePath);
    missingWarnings.delete(filePath);
    busyPaths.delete(filePath);
  }
}
