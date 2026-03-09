import { watch, readTextFile } from "@tauri-apps/plugin-fs";
import { confirm } from "@tauri-apps/plugin-dialog";
import * as monaco from "monaco-editor";
import type { Dispatch } from "react";
import type { EditorAction, Tab } from "../types";

type UnwatchFn = () => void;

const watchers = new Map<string, UnwatchFn>();

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
      // We care about modify events
      const kinds = Array.isArray(event) ? event : [event];
      const isModify = kinds.some(
        (e) =>
          e.type != null &&
          typeof e.type === "object" &&
          "modify" in (e.type as Record<string, unknown>)
      );

      if (!isModify) return;

      const latestTab = getLatestTab();
      if (!latestTab) return;

      try {
        const content = await readTextFile(filePath);
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
        // File might have been deleted
        console.warn("Failed to reload file:", filePath);
      }
    });

    watchers.set(filePath, unwatch as unknown as UnwatchFn);
  } catch (err) {
    console.error("Failed to watch file:", filePath, err);
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
}

/**
 * Stop all file watchers.
 */
export function unwatchAll(): void {
  for (const [id, unwatch] of watchers) {
    unwatch();
    watchers.delete(id);
  }
}
