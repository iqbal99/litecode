import type * as monaco from "monaco-editor";

let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;

export function getEditorRef(): monaco.editor.IStandaloneCodeEditor | null {
  return editorInstance;
}

export function setEditorRef(
  editor: monaco.editor.IStandaloneCodeEditor | null
): void {
  editorInstance = editor;
}
