import { open, save, message } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";
import * as monaco from "monaco-editor";
import type { Tab, EditorAction } from "../types";
import { persistRecentFile } from "../store/recentFiles";
import { showNotification } from "./notifications";
import { suppressPath, unsuppressPath } from "./fileWatcher";

let untitledCounter = 0;
const inFlightUris = new Set<string>();

type DirtyCloseAction = "save" | "discard" | "cancel";

/**
 * Detect Monaco language ID from file extension.
 */
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

/**
 * Get file name from a file path.
 */
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

/**
 * Create a new untitled tab.
 */
export function newFile(dispatch: React.Dispatch<EditorAction>): void {
  untitledCounter++;
  const id = `untitled-${untitledCounter}-${Date.now()}`;
  const fileName = `Untitled-${untitledCounter}`;
  const uri = monaco.Uri.parse(`inmemory://model/${id}`);

  // Create Monaco model
  monaco.editor.createModel("", "plaintext", uri);

  dispatch({ type: "OPEN_TAB", tab: createTab(id, null, fileName, "plaintext", uri.toString()) });
}

/**
 * Open a file dialog and open the selected file(s).
 */
export async function openFile(
  dispatch: React.Dispatch<EditorAction>
): Promise<void> {
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

/**
 * Open a file by its path.
 */
export async function openFilePath(
  filePath: string,
  dispatch: React.Dispatch<EditorAction>
): Promise<boolean> {
  try {
    const content = await readTextFile(filePath);
    const language = detectLanguage(filePath);
    const fileName = getFileName(filePath);
    const id = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Use file:// URI so Monaco's TypeScript/language workers reliably identify
    // the file type from the extension (e.g. file:///Users/x/foo.tsx → typescript)
    const uri = monaco.Uri.file(filePath);
    const uriStr = uri.toString();

    // Prevent duplicate model creation from rapid parallel calls
    if (inFlightUris.has(uriStr)) {
      dispatch({ type: "OPEN_TAB", tab: createTab(id, filePath, fileName, language, uriStr) });
      return true;
    }

    // Check if model for this URI already exists (file already open)
    const existingModel = monaco.editor.getModel(uri);
    if (existingModel) {
      // File is already open — just switch to that tab via OPEN_TAB
      // (reducer detects duplicate by filePath and activates existing tab)
      dispatch({ type: "OPEN_TAB", tab: createTab(id, filePath, fileName, language, uriStr) });
      return true;
    }

    inFlightUris.add(uriStr);
    try {
      // Create Monaco model
      monaco.editor.createModel(content, language, uri);

      dispatch({ type: "OPEN_TAB", tab: createTab(id, filePath, fileName, language, uriStr) });
      dispatch({ type: "ADD_RECENT_FILE", filePath });
      persistRecentFile(filePath); // persist to disk (fire-and-forget)
    } finally {
      inFlightUris.delete(uriStr);
    }
    return true;
  } catch (err) {
    console.error("Failed to open file:", err);
    const missing = !(await exists(filePath).catch(() => true));
    showNotification(
      dispatch,
      "error",
      missing
        ? `LiteCode could not find "${getFileName(filePath)}".`
        : `LiteCode could not open "${getFileName(filePath)}".`
    );
    return false;
  }
}

/**
 * Save the current tab's content to its file path.
 */
export async function saveFile(
  tab: Tab,
  dispatch: React.Dispatch<EditorAction>
): Promise<boolean> {
  if (!tab.filePath) {
    return saveFileAs(tab, dispatch);
  }

  try {
    const uri = monaco.Uri.parse(tab.modelUri);
    const model = monaco.editor.getModel(uri);
    if (!model) return false;

    const content = model.getValue();
    suppressPath(tab.filePath);
    try {
      await writeTextFile(tab.filePath, content);
    } finally {
      setTimeout(() => unsuppressPath(tab.filePath!), 1500);
    }
    dispatch({ type: "MARK_CLEAN", tabId: tab.id });
    return true;
  } catch (err) {
    console.error("Failed to save file:", err);
    showNotification(dispatch, "error", `LiteCode could not save "${tab.fileName}".`);
    return false;
  }
}

/**
 * Save the current tab with a new file path (Save As).
 */
export async function saveFileAs(
  tab: Tab,
  dispatch: React.Dispatch<EditorAction>
): Promise<boolean> {
  const filePath = await save({
    defaultPath: tab.filePath ?? tab.fileName,
    filters: [{ name: "All Files", extensions: ["*"] }],
  });

  if (!filePath) return false;

  try {
    const uri = monaco.Uri.parse(tab.modelUri);
    const model = monaco.editor.getModel(uri);
    if (!model) return false;

    const fileName = getFileName(filePath);
    const language = detectLanguage(filePath);
    const fileUri = monaco.Uri.file(filePath);
    const fileUriStr = fileUri.toString();
    const existingModel = monaco.editor.getModel(fileUri);

    if (existingModel && existingModel.uri.toString() !== tab.modelUri) {
      await message(
        `"${fileName}" is already open in another tab. Close that tab or save to a different path.`,
        { title: "Save As Blocked", kind: "warning" }
      );
      return false;
    }

    const content = model.getValue();
    suppressPath(filePath);
    try {
      await writeTextFile(filePath, content);
    } finally {
      setTimeout(() => unsuppressPath(filePath), 1500);
    }

    if (tab.modelUri !== fileUriStr) {
      const nextModel = monaco.editor.createModel(content, language, fileUri);
      nextModel.updateOptions({
        tabSize: model.getOptions().tabSize,
        insertSpaces: model.getOptions().insertSpaces,
      });
      dispatch({
        type: "UPDATE_TAB_FILE_INFO",
        tabId: tab.id,
        filePath,
        fileName,
        language,
        modelUri: fileUriStr,
      });
    } else {
      dispatch({ type: "UPDATE_TAB_PATH", tabId: tab.id, filePath, fileName });
      dispatch({ type: "SET_LANGUAGE", tabId: tab.id, language });
      monaco.editor.setModelLanguage(model, language);
    }

    dispatch({ type: "MARK_CLEAN", tabId: tab.id });
    dispatch({ type: "ADD_RECENT_FILE", filePath });
    persistRecentFile(filePath); // persist to disk (fire-and-forget)

    return true;
  } catch (err) {
    console.error("Failed to save file:", err);
    showNotification(dispatch, "error", `LiteCode could not save "${tab.fileName}" to disk.`);
    return false;
  }
}

/**
 * Close a tab, prompting to save if dirty.
 */
export async function closeTab(
  tab: Tab,
  dispatch: React.Dispatch<EditorAction>
): Promise<boolean> {
  if (tab.isDirty) {
    const action = await promptDirtyTabAction(tab);
    if (action === "cancel") return false;

    if (action === "save") {
      const saved = await saveFile(tab, dispatch);
      if (!saved) return false; // User cancelled save dialog
    }
  }

  // Dispose Monaco model
  const uri = monaco.Uri.parse(tab.modelUri);
  const model = monaco.editor.getModel(uri);
  model?.dispose();

  dispatch({ type: "CLOSE_TAB", tabId: tab.id });
  return true;
}
