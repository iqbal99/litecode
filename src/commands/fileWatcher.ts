import { watch, readTextFile } from "@tauri-apps/plugin-fs";
import { confirm } from "@tauri-apps/plugin-dialog";
import * as monaco from "monaco-editor";
import type { Dispatch } from "react";
import type { EditorAction, Tab } from "../types";
import { showNotification } from "./notifications";

type UnwatchFn = () => void;

const watchers = new Map<string, UnwatchFn>();
const missingWarnings = new Set<string>();
const suppressedPaths = new Set<string>();

/**
 * Temporarily suppress watcher events for a path (used during saves
 * so the app's own writes don't trigger reload prompts or re-dirty the tab).
 */
export function suppressPath(filePath: string): void {
  suppressedPaths.add(filePath);
}

export function unsuppressPath(filePath: string): void {
  suppressedPaths.delete(filePath);
}

function isFileEventType(event: unknown, key: "modify" | "remove" | "create"): boolean {
  return (
    event != null &&
    typeof event === "object" &&
    "type" in event &&
    typeof event.type === "object" &&
    event.type != null &&
    key in (event.type as Record<string, unknown>)
  );
}

/**
 * Start watching a file for external changes.
 * When the file changes on disk and the tab is not dirty, auto-reload.
 * When dirty, prompt the user.
 */
export async function watchFile(
  tab: Tab,
  getLatestTab: () => Tab | undefined,
  dispatch: Dispatch<EditorAction>
): Promise<void> {
  if (!tab.filePath) return;
  // Don't double-watch — key by filePath so reopening the same file is safe
  if (watchers.has(tab.filePath)) return;

  const filePath = tab.filePath;

  try {
    const unwatch = await watch(filePath, async (event) => {
      const kinds = Array.isArray(event) ? event : [event];
      const isModify = kinds.some((e) => isFileEventType(e, "modify"));
      const isRemove = kinds.some((e) => isFileEventType(e, "remove"));
      const isCreate = kinds.some((e) => isFileEventType(e, "create"));

      if (!isModify && !isRemove && !isCreate) return;

      if (suppressedPaths.has(filePath)) return;

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

      try {
        const content = await readTextFile(filePath);
        missingWarnings.delete(filePath);
        const model = monaco.editor.getModel(
          monaco.Uri.parse(latestTab.modelUri)
        );
        if (!model) return;

        // Check if content actually differs (normalize line endings)
        const normalize = (s: string) => s.replace(/\r\n/g, "\n");
        if (normalize(model.getValue()) === normalize(content)) return;

        if (latestTab.isDirty) {
          // Prompt user
          const reload = await confirm(
            `"${latestTab.fileName}" has been modified externally. Reload and lose your changes?`,
            { title: "File Changed", kind: "warning" }
          );
          if (!reload) return;
        }

        // Update the model content
        model.setValue(content);
        dispatch({ type: "MARK_CLEAN", tabId: latestTab.id });
      } catch {
        if (!missingWarnings.has(filePath)) {
          missingWarnings.add(filePath);
          showNotification(dispatch, "warning", `LiteCode could not reload "${latestTab.fileName}" from disk.`);
        }
      }
    });

    watchers.set(filePath, unwatch as unknown as UnwatchFn);
  } catch (err) {
    console.error("Failed to watch file:", filePath, err);
    showNotification(dispatch, "warning", `LiteCode could not watch "${tab.fileName}" for external changes.`);
  }
}

/**
 * Stop watching a file.
 */
export function unwatchFile(filePath: string): void {
  const unwatch = watchers.get(filePath);
  if (unwatch) {
    unwatch();
    watchers.delete(filePath);
  }
  missingWarnings.delete(filePath);
}

/**
 * Stop all file watchers.
 */
export function unwatchAll(): void {
  for (const [id, unwatch] of watchers) {
    unwatch();
    watchers.delete(id);
    missingWarnings.delete(id);
  }
}
