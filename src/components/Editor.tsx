import { useRef, useCallback, useEffect } from "react";
import MonacoEditor, { BeforeMount, OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useEditor } from "../store/editorStore";
import { watchFile, unwatchFile, unwatchAll } from "../commands/fileWatcher";
import { registerFormatters } from "../commands/formatter";
import type { Tab } from "../types";

export default function Editor() {
  const { state, dispatch } = useEditor();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const disposablesRef = useRef<monaco.IDisposable[]>([]);
  const activeTabId = state.activeTabId;

  // Always-fresh refs so event handlers never capture stale closures
  const tabsRef = useRef<Tab[]>(state.tabs);
  tabsRef.current = state.tabs;
  const activeTabIdRef = useRef<string | null>(activeTabId);
  activeTabIdRef.current = activeTabId;
  const settingsRef = useRef(state.settings);
  settingsRef.current = state.settings;

  // Track previous tab IDs to detect additions and removals
  const prevTabIdsRef = useRef<Set<string>>(new Set());
  const prevTabPathsRef = useRef<Map<string, string>>(new Map()); // tabId → filePath
  const activeTab = state.tabs.find((t) => t.id === activeTabId) ?? null;

  const handleBeforeMount: BeforeMount = useCallback((m) => {
    m.editor.defineTheme("litecode-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#f3f3f3",
      },
    });

    // Register generic formatters for languages without Monaco built-in support
    registerFormatters(m);
  }, []);

  const monacoTheme = state.theme === "vs" ? "litecode-light" : state.theme;

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
      disposablesRef.current.push(editor.onDidChangeCursorPosition((e) => {
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
      }));

      // Dirty tracking — same ref fix
      disposablesRef.current.push(editor.onDidChangeModelContent(() => {
        const tabId = activeTabIdRef.current;
        if (tabId) dispatch({ type: "MARK_DIRTY", tabId });
      }));

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

        // Seed indentation on newly-opened models:
        // - always for empty/new files (nothing to detect from)
        // - always when detectIndentation is off (user wants their settings forced)
        if (model.getValue().length === 0 || !settingsRef.current.detectIndentation) {
          model.updateOptions({
            tabSize: settingsRef.current.tabSize,
            insertSpaces: settingsRef.current.insertSpaces,
          });
        }

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

  // Clear or restore diagnostics markers when toggle changes
  useEffect(() => {
    if (!state.diagnostics) {
      // Clear all markers on every model
      monaco.editor.getModels().forEach((model) => {
        monaco.editor.setModelMarkers(model, "owner", []);
      });
    }
  }, [state.diagnostics]);

  // Intercept marker changes when diagnostics are disabled
  useEffect(() => {
    if (state.diagnostics) return;
    const id = setInterval(() => {
      monaco.editor.getModels().forEach((model) => {
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        if (markers.length > 0) {
          monaco.editor.setModelMarkers(model, "owner", []);
        }
      });
    }, 300);
    return () => clearInterval(id);
  }, [state.diagnostics]);

  // Sync editor options when settings change
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const s = state.settings;
    editor.updateOptions({
      fontSize: state.fontSize,
      wordWrap: state.wordWrap,
      minimap: { enabled: state.minimap, side: s.minimapSide },
      fontFamily: s.fontFamily || undefined,
      lineHeight: s.lineHeight || 0,
      fontLigatures: s.fontLigatures,
      wordWrapColumn: s.wordWrapColumn,
      tabSize: s.tabSize,
      insertSpaces: s.insertSpaces,
      detectIndentation: s.detectIndentation,
      renderWhitespace: s.renderWhitespace,
      lineNumbers: s.lineNumbers,
      cursorBlinking: s.cursorBlinking,
      cursorStyle: s.cursorStyle,
      smoothScrolling: s.smoothScrolling,
      mouseWheelZoom: s.mouseWheelZoom,
      scrollBeyondLastLine: s.scrollBeyondLastLine,
      formatOnPaste: s.formatOnPaste,
      formatOnType: s.formatOnType,
      autoClosingBrackets: s.autoClosingBrackets,
      autoClosingQuotes: s.autoClosingQuotes,
      bracketPairColorization: { enabled: s.bracketPairColorization },
      guides: { bracketPairs: s.showBracketGuides, indentation: s.showBracketGuides },
      folding: s.folding,
      links: s.links,
      quickSuggestions: s.quickSuggestions
        ? { other: true, comments: false, strings: true }
        : false,
      parameterHints: { enabled: s.parameterHints, cycle: true },
      acceptSuggestionOnEnter: s.acceptSuggestionOnEnter,
      tabCompletion: s.tabCompletion,
      snippetSuggestions: s.snippetSuggestions,
      matchBrackets: s.matchBrackets,
      autoSurround: s.autoSurround,
    });

    // Push indentation settings to every open model so formatters pick them up.
    // When detectIndentation is true Monaco auto-detects per file; we only
    // override models that have no content (new / untitled files) in that case.
    const modelOpts = { tabSize: s.tabSize, insertSpaces: s.insertSpaces };
    monaco.editor.getModels().forEach((model) => {
      if (!s.detectIndentation || model.getValue().length === 0) {
        model.updateOptions(modelOpts);
      }
    });
  }, [state.fontSize, state.wordWrap, state.minimap, state.settings]);

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
        const fp = prevTabPathsRef.current.get(id);
        if (fp) unwatchFile(fp);
      }
    });

    prevTabIdsRef.current = currentIds;
    const pathMap = new Map<string, string>();
    state.tabs.forEach((t) => { if (t.filePath) pathMap.set(t.id, t.filePath); });
    prevTabPathsRef.current = pathMap;
  }, [state.tabs, dispatch]);

  // Clean up all watchers and editor listeners when editor unmounts
  useEffect(() => () => {
    unwatchAll();
    disposablesRef.current.forEach((d) => d.dispose());
    disposablesRef.current = [];
  }, []);

  if (!activeTab) {
    return null; // Welcome screen shown instead
  }

  return (
    <div className="editor-container">
      <MonacoEditor
        theme={monacoTheme}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          fontSize: state.fontSize,
          wordWrap: state.wordWrap,
          minimap: { enabled: state.minimap, side: state.settings.minimapSide },
          fontFamily: state.settings.fontFamily || undefined,
          lineHeight: state.settings.lineHeight || 0,
          fontLigatures: state.settings.fontLigatures,
          wordWrapColumn: state.settings.wordWrapColumn,
          automaticLayout: true,
          scrollBeyondLastLine: state.settings.scrollBeyondLastLine,
          renderWhitespace: state.settings.renderWhitespace,
          cursorBlinking: state.settings.cursorBlinking,
          cursorStyle: state.settings.cursorStyle,
          smoothScrolling: state.settings.smoothScrolling,
          padding: { top: 8 },
          // Bracket & guide features
          bracketPairColorization: { enabled: state.settings.bracketPairColorization },
          guides: { bracketPairs: state.settings.showBracketGuides, indentation: state.settings.showBracketGuides },
          // Completions & IntelliSense
          suggest: {
            showWords: true,
            showSnippets: true,
            showKeywords: true,
            preview: true,
            filterGraceful: true,
          },
          quickSuggestions: state.settings.quickSuggestions
            ? { other: true, comments: false, strings: true }
            : false,
          quickSuggestionsDelay: 100,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: state.settings.acceptSuggestionOnEnter,
          tabCompletion: state.settings.tabCompletion,
          parameterHints: { enabled: state.settings.parameterHints, cycle: true },
          // Formatting
          formatOnPaste: state.settings.formatOnPaste,
          formatOnType: state.settings.formatOnType,
          // Editing quality-of-life
          autoClosingBrackets: state.settings.autoClosingBrackets,
          autoClosingQuotes: state.settings.autoClosingQuotes,
          autoSurround: state.settings.autoSurround,
          matchBrackets: state.settings.matchBrackets,
          snippetSuggestions: state.settings.snippetSuggestions,
          // Behaviour
          tabSize: state.settings.tabSize,
          detectIndentation: state.settings.detectIndentation,
          insertSpaces: state.settings.insertSpaces,
          lineNumbers: state.settings.lineNumbers,
          folding: state.settings.folding,
          links: state.settings.links,
          contextmenu: true,
          mouseWheelZoom: state.settings.mouseWheelZoom,
          // Find
          find: { addExtraSpaceOnTop: false, autoFindInSelection: "multiline" },
        }}
      />
    </div>
  );
}
