import { open, save, message } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";
import * as monaco from "monaco-editor";
import type { Tab } from "../types";
import type { AppDispatch } from "../store/store";
import {
  openTab,
  setActiveTab,
  addRecentFile,
  markClean,
  updateTabFileInfo,
  updateTabPath,
  setLanguage,
  closeTab as closeTabAction,
} from "../store/editorSlice";
import { store } from "../store/store";
import { persistRecentFile } from "../store/recentFiles";
import { showNotification } from "./notifications";
import { watchFile, unwatchFile } from "./fileWatcher";

let untitledCounter = 0;
const inFlightOpens = new Map<string, Promise<boolean>>();

type DirtyCloseAction = "save" | "discard" | "cancel";

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "cpp",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    ps1: "powershell",
    sql: "sql",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    ini: "ini",
    conf: "ini",
    dockerfile: "dockerfile",
    graphql: "graphql",
    gql: "graphql",
    lua: "lua",
    r: "r",
    dart: "dart",
    vue: "html",
    svelte: "html",
    txt: "plaintext",
    log: "plaintext",
    env: "plaintext",
    gitignore: "plaintext",
  };
  return map[ext] || "plaintext";
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function createTab(
  id: string,
  filePath: string | null,
  fileName: string,
  language: string,
  modelUri: string
): Tab {
  return {
    id,
    filePath,
    fileName,
    isDirty: false,
    language,
    modelUri,
    cursorPosition: { lineNumber: 1, column: 1 },
    scrollPosition: { scrollTop: 0, scrollLeft: 0 },
  };
}

async function promptDirtyTabAction(tab: Tab): Promise<DirtyCloseAction> {
  const result = await message(
    `Do you want to save changes to ${tab.fileName}?`,
    {
      title: "Unsaved Changes",
      kind: "warning",
      buttons: "YesNoCancel",
    }
  );

  if (result === "Yes") return "save";
  if (result === "No") return "discard";
  return "cancel";
}

export function newFile(dispatch: AppDispatch): void {
  untitledCounter++;
  const id = `untitled-${untitledCounter}-${Date.now()}`;
  const fileName = `Untitled-${untitledCounter}`;
  const uri = monaco.Uri.parse(`inmemory://model/${id}`);

  monaco.editor.createModel("", "plaintext", uri);

  dispatch(openTab(createTab(id, null, fileName, "plaintext", uri.toString())));
}

export async function openFile(dispatch: AppDispatch): Promise<void> {
  const result = await open({
    multiple: true,
    directory: false,
    filters: [
      {
        name: "All Files",
        extensions: ["*"],
      },
      {
        name: "Text Files",
        extensions: [
          "txt", "md", "json", "js", "ts", "tsx", "jsx", "html", "css",
          "scss", "py", "rs", "go", "java", "c", "cpp", "h", "rb", "php",
          "xml", "yaml", "yml", "toml", "sh", "sql", "swift", "kt",
        ],
      },
    ],
  });

  if (!result) return;

  const paths = Array.isArray(result) ? result : [result];
  for (const filePath of paths) {
    await openFilePath(filePath, dispatch);
  }
}

function focusExistingTabForPath(
  filePath: string,
  dispatch: AppDispatch
): boolean {
  const existing = store
    .getState()
    .editor.tabs.find((t) => t.filePath === filePath && !t.isSettings);
  if (existing) {
    dispatch(setActiveTab(existing.id));
    return true;
  }
  return false;
}

export async function openFilePath(
  filePath: string,
  dispatch: AppDispatch
): Promise<boolean> {
  const language = detectLanguage(filePath);
  const fileName = getFileName(filePath);
  const id = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const uri = monaco.Uri.file(filePath);
  const uriStr = uri.toString();

  // Focus an existing tab first (matches by filePath, avoids creating a stale id).
  if (focusExistingTabForPath(filePath, dispatch)) {
    return true;
  }

  const pushNewTab = () => {
    dispatch(openTab(createTab(id, filePath, fileName, language, uriStr)));
  };

  // Model already exists but no open tab owns it (e.g. stale after close race).
  // Dispose it so we do not hand a different tab a leftover model.
  const stale = monaco.editor.getModel(uri);
  if (stale) {
    stale.dispose();
  }

  const pending = inFlightOpens.get(uriStr);
  if (pending) {
    const ok = await pending;
    if (!ok) return false;
    if (focusExistingTabForPath(filePath, dispatch)) return true;
    // The original opener failed to leave a tab; model may exist — reuse it.
    if (monaco.editor.getModel(uri)) {
      pushNewTab();
      return true;
    }
    return false;
  }

  const openPromise = (async (): Promise<boolean> => {
    try {
      const content = await readTextFile(filePath);
      // Another opener may have raced us; only create the model once.
      if (!monaco.editor.getModel(uri)) {
        monaco.editor.createModel(content, language, uri);
      }

      pushNewTab();
      dispatch(addRecentFile(filePath));
      persistRecentFile(filePath);
      return true;
    } catch (err) {
      console.error("Failed to open file:", err);
      let missing = false;
      try {
        missing = !(await exists(filePath));
      } catch {
        missing = false;
      }
      showNotification(
        dispatch,
        "error",
        missing
          ? `LiteCode could not find "${getFileName(filePath)}".`
          : `LiteCode could not open "${getFileName(filePath)}".`
      );
      return false;
    }
  })();

  inFlightOpens.set(uriStr, openPromise);
  try {
    return await openPromise;
  } finally {
    if (inFlightOpens.get(uriStr) === openPromise) {
      inFlightOpens.delete(uriStr);
    }
  }
}

export async function saveFile(
  tab: Tab,
  dispatch: AppDispatch
): Promise<boolean> {
  if (!tab.filePath) {
    return saveFileAs(tab, dispatch);
  }

  try {
    const uri = monaco.Uri.parse(tab.modelUri);
    const model = monaco.editor.getModel(uri);
    if (!model) {
      showNotification(dispatch, "error", `LiteCode could not find an editor model for "${tab.fileName}".`);
      return false;
    }

    const content = model.getValue();
    const savePath = tab.filePath;

    // Unwatch before saving to prevent self-triggered reload prompts.
    unwatchFile(savePath);

    try {
      await writeTextFile(savePath, content);
    } finally {
      // Re-establish the watcher after the save completes.
      watchFile(
        tab,
        () => store.getState().editor.tabs.find((t) => t.id === tab.id),
        dispatch
      );
    }
    dispatch(markClean(tab.id));
    return true;
  } catch (err) {
    console.error("Failed to save file:", err);
    showNotification(dispatch, "error", `LiteCode could not save "${tab.fileName}".`);
    return false;
  }
}

export async function saveFileAs(
  tab: Tab,
  dispatch: AppDispatch
): Promise<boolean> {
  const filePath = await save({
    defaultPath: tab.filePath ?? tab.fileName,
    filters: [{ name: "All Files", extensions: ["*"] }],
  });

  if (!filePath) return false;

  try {
    const uri = monaco.Uri.parse(tab.modelUri);
    const model = monaco.editor.getModel(uri);
    if (!model) {
      showNotification(dispatch, "error", `LiteCode could not find an editor model for "${tab.fileName}".`);
      return false;
    }

    const fileName = getFileName(filePath);
    const language = detectLanguage(filePath);
    const fileUri = monaco.Uri.file(filePath);
    const fileUriStr = fileUri.toString();
    const existingModel = monaco.editor.getModel(fileUri);

    if (existingModel && existingModel.uri.toString() !== tab.modelUri) {
      const ownedByOtherTab = store
        .getState()
        .editor.tabs.some((t) => t.id !== tab.id && t.modelUri === fileUriStr);
      if (ownedByOtherTab) {
        await message(
          `"${fileName}" is already open in another tab. Close that tab or save to a different path.`,
          { title: "Save As Blocked", kind: "warning" }
        );
        return false;
      }
      // Stale model with no owning tab — drop it.
      existingModel.dispose();
    }

    const content = model.getValue();

    // Unwatch before saving to prevent self-triggered reload prompts.
    unwatchFile(filePath);

    try {
      await writeTextFile(filePath, content);
    } finally {
      // If the path didn't change, we must manually re-watch because the
      // Editor.tsx useEffect won't trigger for the same path.
      if (filePath === tab.filePath) {
        watchFile(
          tab,
          () => store.getState().editor.tabs.find((t) => t.id === tab.id),
          dispatch
        );
      }
    }

    if (tab.modelUri !== fileUriStr) {
      const prevOptions = model.getOptions();
      const nextModel = monaco.editor.createModel(content, language, fileUri);
      nextModel.updateOptions({
        tabSize: prevOptions.tabSize,
        insertSpaces: prevOptions.insertSpaces,
      });
      dispatch(updateTabFileInfo({
        tabId: tab.id,
        filePath,
        fileName,
        language,
        modelUri: fileUriStr,
      }));
      // Dispose the old (typically `inmemory://`) model now that state points at the new one.
      model.dispose();
    } else {
      dispatch(updateTabPath({ tabId: tab.id, filePath, fileName }));
      dispatch(setLanguage({ tabId: tab.id, language }));
      monaco.editor.setModelLanguage(model, language);
    }

    dispatch(markClean(tab.id));
    dispatch(addRecentFile(filePath));
    persistRecentFile(filePath);

    return true;
  } catch (err) {
    console.error("Failed to save file:", err);
    showNotification(dispatch, "error", `LiteCode could not save "${tab.fileName}" to disk.`);
    return false;
  }
}

export async function closeTab(
  tab: Tab,
  dispatch: AppDispatch
): Promise<boolean> {
  if (tab.isDirty) {
    const action = await promptDirtyTabAction(tab);
    if (action === "cancel") return false;

    if (action === "save") {
      const saved = await saveFile(tab, dispatch);
      if (!saved) return false;
    }
  }

  const uri = monaco.Uri.parse(tab.modelUri);
  const model = monaco.editor.getModel(uri);
  model?.dispose();

  dispatch(closeTabAction(tab.id));
  return true;
}
