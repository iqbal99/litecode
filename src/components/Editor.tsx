import { useRef, useCallback, useEffect } from "react";
import MonacoEditor, { OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useEditor } from "../store/editorStore";
import { watchFile, unwatchFile, unwatchAll } from "../commands/fileWatcher";
import type { Tab } from "../types";

export default function Editor() {
  const { state, dispatch } = useEditor();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const activeTabId = state.activeTabId;

  // Always-fresh refs so event handlers never capture stale closures
  const tabsRef = useRef<Tab[]>(state.tabs);
  tabsRef.current = state.tabs;
  const activeTabIdRef = useRef<string | null>(activeTabId);
  activeTabIdRef.current = activeTabId;

  // Track previous tab IDs to detect additions and removals
  const prevTabIdsRef = useRef<Set<string>>(new Set());
  const activeTab = state.tabs.find((t) => t.id === activeTabId) ?? null;

  const handleMount: OnMount = useCallback(
    (editor) => {
      editorRef.current = editor;

      // Set the model for the active tab
      if (activeTab?.modelUri) {
        const model = monaco.editor.getModel(
          monaco.Uri.parse(activeTab.modelUri)
        );
        if (model) editor.setModel(model);
      }

      // Cursor tracking — read activeTabIdRef so it’s always current
      editor.onDidChangeCursorPosition((e) => {
        const tabId = activeTabIdRef.current;
        if (tabId) {
          dispatch({
            type: "UPDATE_CURSOR",
            tabId,
            position: {
              lineNumber: e.position.lineNumber,
              column: e.position.column,
            },
          });
        }
      });

      // Dirty tracking — same ref fix
      editor.onDidChangeModelContent(() => {
        const tabId = activeTabIdRef.current;
        if (tabId) dispatch({ type: "MARK_DIRTY", tabId });
      });

      editor.focus();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Switch model when active tab changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (!activeTab) {
      editor.setModel(null);
      return;
    }

    if (activeTab.modelUri) {
      const model = monaco.editor.getModel(
        monaco.Uri.parse(activeTab.modelUri)
      );
      if (model && editor.getModel() !== model) {
        // Save scroll position of previous tab
        const prevModel = editor.getModel();
        if (prevModel) {
          const prevTab = state.tabs.find(
            (t) => t.modelUri === prevModel.uri.toString()
          );
          if (prevTab) {
            dispatch({
              type: "UPDATE_SCROLL",
              tabId: prevTab.id,
              position: {
                scrollTop: editor.getScrollTop(),
                scrollLeft: editor.getScrollLeft(),
              },
            });
          }
        }

        editor.setModel(model);

        // Restore cursor/scroll for new tab
        if (activeTab.cursorPosition) {
          editor.setPosition({
            lineNumber: activeTab.cursorPosition.lineNumber,
            column: activeTab.cursorPosition.column,
          });
        }
        if (activeTab.scrollPosition) {
          editor.setScrollTop(activeTab.scrollPosition.scrollTop);
          editor.setScrollLeft(activeTab.scrollPosition.scrollLeft);
        }

        editor.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  // Sync editor options when settings change
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({
      fontSize: state.fontSize,
      wordWrap: state.wordWrap,
      minimap: { enabled: state.minimap },
    });
  }, [state.fontSize, state.wordWrap, state.minimap]);

  // Manage file watchers as tabs open and close
  useEffect(() => {
    const currentIds = new Set(state.tabs.map((t) => t.id));

    // Start watcher for newly opened tabs that have a real file path
    state.tabs.forEach((tab) => {
      if (tab.filePath && !prevTabIdsRef.current.has(tab.id)) {
        watchFile(
          tab,
          () => tabsRef.current.find((t) => t.id === tab.id),
          dispatch
        );
      }
    });

    // Stop watcher for tabs that were closed
    prevTabIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        unwatchFile(id);
      }
    });

    prevTabIdsRef.current = currentIds;
  }, [state.tabs, dispatch]);

  // Clean up all watchers when editor unmounts
  useEffect(() => () => unwatchAll(), []);

  if (!activeTab) {
    return null; // Welcome screen shown instead
  }

  return (
    <div className="editor-container">
      <MonacoEditor
        theme={state.theme}
        onMount={handleMount}
        options={{
          fontSize: state.fontSize,
          wordWrap: state.wordWrap,
          minimap: { enabled: state.minimap },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          renderWhitespace: "selection",
          cursorBlinking: "smooth",
          smoothScrolling: true,
          padding: { top: 8 },
          // Bracket & guide features
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          // Completions & IntelliSense
          suggest: {
            showWords: true,
            showSnippets: true,
            showKeywords: true,
            preview: true,
            filterGraceful: true,
          },
          quickSuggestions: { other: true, comments: false, strings: true },
          quickSuggestionsDelay: 100,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: "on",
          tabCompletion: "on",
          parameterHints: { enabled: true, cycle: true },
          // Formatting
          formatOnPaste: true,
          formatOnType: false,
          // Editing quality-of-life
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          autoSurround: "languageDefined",
          matchBrackets: "always",
          snippetSuggestions: "inline",
          // Behaviour
          tabSize: 2,
          detectIndentation: true,
          insertSpaces: true,
          lineNumbers: "on",
          folding: true,
          links: true,
          contextmenu: true,
          mouseWheelZoom: true,
          // Find
          find: { addExtraSpaceOnTop: false, autoFindInSelection: "multiline" },
        }}
      />
    </div>
  );
}
