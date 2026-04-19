import { useRef, useCallback, useEffect } from "react";
import MonacoEditor, { BeforeMount, OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import { getEditorRef, setEditorRef } from "../store/editorRef";
import { updateCursor, markDirty, updateScroll } from "../store/editorSlice";
import { watchFile, unwatchFile, unwatchAll } from "../commands/fileWatcher";
import { registerFormatters } from "../commands/formatter";
import type { Tab } from "../types";

export default function Editor() {
  const tabs = useAppSelector((s) => s.editor.tabs);
  const activeTabId = useAppSelector((s) => s.editor.activeTabId);
  const theme = useAppSelector((s) => s.editor.theme);
  const fontSize = useAppSelector((s) => s.editor.fontSize);
  const wordWrap = useAppSelector((s) => s.editor.wordWrap);
  const minimapEnabled = useAppSelector((s) => s.editor.minimap);
  const diagnosticsEnabled = useAppSelector((s) => s.editor.diagnostics);
  const settings = useAppSelector((s) => s.editor.settings);
  const dispatch = useAppDispatch();

  const disposablesRef = useRef<monaco.IDisposable[]>([]);

  const tabsRef = useRef<Tab[]>(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef<string | null>(activeTabId);
  activeTabIdRef.current = activeTabId;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const prevTabIdsRef = useRef<Set<string>>(new Set());
  const prevTabPathsRef = useRef<Map<string, string>>(new Map());
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const handleBeforeMount: BeforeMount = useCallback((m) => {
    m.editor.defineTheme("litecode-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#f3f3f3",
      },
    });

    registerFormatters(m);
  }, []);

  const monacoTheme = theme === "vs" ? "litecode-light" : theme;

  const handleMount: OnMount = useCallback(
    (editor) => {
      setEditorRef(editor);

      // Dispose any leftover listeners from a prior (StrictMode) mount before adding new ones.
      for (const d of disposablesRef.current) {
        try { d.dispose(); } catch { /* ignore */ }
      }
      disposablesRef.current = [];

      // Use the latest active tab at mount (not the value captured at first render).
      const latestTabId = activeTabIdRef.current;
      const latestTab = latestTabId
        ? tabsRef.current.find((t) => t.id === latestTabId)
        : null;
      if (latestTab?.modelUri && !latestTab.isSettings) {
        const model = monaco.editor.getModel(
          monaco.Uri.parse(latestTab.modelUri)
        );
        if (model) {
          editor.setModel(model);
          if (latestTab.cursorPosition) {
            editor.setPosition({
              lineNumber: latestTab.cursorPosition.lineNumber,
              column: latestTab.cursorPosition.column,
            });
          }
          if (latestTab.scrollPosition) {
            editor.setScrollTop(latestTab.scrollPosition.scrollTop);
            editor.setScrollLeft(latestTab.scrollPosition.scrollLeft);
          }
        }
      }

      disposablesRef.current.push(editor.onDidChangeCursorPosition((e) => {
        const tabId = activeTabIdRef.current;
        if (tabId) {
          dispatch(updateCursor({
            tabId,
            position: {
              lineNumber: e.position.lineNumber,
              column: e.position.column,
            },
          }));
        }
      }));

      disposablesRef.current.push(editor.onDidChangeModelContent(() => {
        const tabId = activeTabIdRef.current;
        if (tabId) dispatch(markDirty(tabId));
      }));

      editor.focus();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const editor = getEditorRef();
    if (!editor) return;

    if (!activeTab || activeTab.isSettings || !activeTab.modelUri) {
      const prevModel = editor.getModel();
      if (prevModel) {
        const prevTab = tabs.find(
          (t) => t.modelUri === prevModel.uri.toString()
        );
        if (prevTab) {
          dispatch(updateScroll({
            tabId: prevTab.id,
            position: {
              scrollTop: editor.getScrollTop(),
              scrollLeft: editor.getScrollLeft(),
            },
          }));
        }
      }
      editor.setModel(null);
      return;
    }

    const model = monaco.editor.getModel(
      monaco.Uri.parse(activeTab.modelUri)
    );
    if (!model) return;

    const modelChanged = editor.getModel() !== model;

    if (modelChanged) {
      const prevModel = editor.getModel();
      if (prevModel) {
        const prevTab = tabs.find(
          (t) => t.modelUri === prevModel.uri.toString()
        );
        if (prevTab) {
          dispatch(updateScroll({
            tabId: prevTab.id,
            position: {
              scrollTop: editor.getScrollTop(),
              scrollLeft: editor.getScrollLeft(),
            },
          }));
        }
      }

      editor.setModel(model);

      if (model.getValue().length === 0 || !settingsRef.current.detectIndentation) {
        model.updateOptions({
          tabSize: settingsRef.current.tabSize,
          insertSpaces: settingsRef.current.insertSpaces,
        });
      }
    }

    // Always restore cursor/scroll on active-tab change, even when the model
    // was already current (e.g. switching away and back to the same tab).
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

    if (modelChanged) {
      editor.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, activeTab?.modelUri]);

  useEffect(() => {
    if (!diagnosticsEnabled) {
      monaco.editor.getModels().forEach((model) => {
        monaco.editor.setModelMarkers(model, "owner", []);
      });
    }
  }, [diagnosticsEnabled]);

  useEffect(() => {
    if (diagnosticsEnabled) return;
    const disposable = monaco.editor.onDidChangeMarkers((uris) => {
      for (const uri of uris) {
        const markers = monaco.editor.getModelMarkers({ resource: uri });
        if (markers.length > 0) {
          const m = monaco.editor.getModel(uri);
          if (m) monaco.editor.setModelMarkers(m, "owner", []);
        }
      }
    });
    return () => disposable.dispose();
  }, [diagnosticsEnabled]);

  useEffect(() => {
    const editor = getEditorRef();
    if (!editor) return;
    const s = settings;
    editor.updateOptions({
      fontSize,
      wordWrap,
      minimap: { enabled: minimapEnabled, side: s.minimapSide },
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

    const modelOpts = { tabSize: s.tabSize, insertSpaces: s.insertSpaces };
    monaco.editor.getModels().forEach((model) => {
      if (!s.detectIndentation || model.getValue().length === 0) {
        model.updateOptions(modelOpts);
      }
    });
  }, [fontSize, wordWrap, minimapEnabled, settings]);

  useEffect(() => {
    const currentIds = new Set(tabs.map((t) => t.id));

    tabs.forEach((tab) => {
      const prevPath = prevTabPathsRef.current.get(tab.id);
      if (prevPath && prevPath !== tab.filePath) {
        unwatchFile(prevPath);
      }
      if (tab.filePath && (prevPath == null || prevPath !== tab.filePath)) {
        watchFile(
          tab,
          () => tabsRef.current.find((t) => t.id === tab.id),
          dispatch
        );
      }
    });

    prevTabIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        const fp = prevTabPathsRef.current.get(id);
        if (fp) unwatchFile(fp);
      }
    });

    prevTabIdsRef.current = currentIds;
    const pathMap = new Map<string, string>();
    tabs.forEach((t) => { if (t.filePath) pathMap.set(t.id, t.filePath); });
    prevTabPathsRef.current = pathMap;
  }, [tabs, dispatch]);

  useEffect(() => () => {
    unwatchAll();
    disposablesRef.current.forEach((d) => d.dispose());
    disposablesRef.current = [];
    setEditorRef(null);
  }, []);

  if (!activeTab) {
    return null;
  }

  return (
    <div className="editor-container">
      <MonacoEditor
        theme={monacoTheme}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          fontSize,
          wordWrap,
          minimap: { enabled: minimapEnabled, side: settings.minimapSide },
          fontFamily: settings.fontFamily || undefined,
          lineHeight: settings.lineHeight || 0,
          fontLigatures: settings.fontLigatures,
          wordWrapColumn: settings.wordWrapColumn,
          automaticLayout: true,
          scrollBeyondLastLine: settings.scrollBeyondLastLine,
          renderWhitespace: settings.renderWhitespace,
          cursorBlinking: settings.cursorBlinking,
          cursorStyle: settings.cursorStyle,
          smoothScrolling: settings.smoothScrolling,
          padding: { top: 8 },
          bracketPairColorization: { enabled: settings.bracketPairColorization },
          guides: { bracketPairs: settings.showBracketGuides, indentation: settings.showBracketGuides },
          suggest: {
            showWords: true,
            showSnippets: true,
            showKeywords: true,
            preview: true,
            filterGraceful: true,
          },
          quickSuggestions: settings.quickSuggestions
            ? { other: true, comments: false, strings: true }
            : false,
          quickSuggestionsDelay: 100,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: settings.acceptSuggestionOnEnter,
          tabCompletion: settings.tabCompletion,
          parameterHints: { enabled: settings.parameterHints, cycle: true },
          formatOnPaste: settings.formatOnPaste,
          formatOnType: settings.formatOnType,
          autoClosingBrackets: settings.autoClosingBrackets,
          autoClosingQuotes: settings.autoClosingQuotes,
          autoSurround: settings.autoSurround,
          matchBrackets: settings.matchBrackets,
          snippetSuggestions: settings.snippetSuggestions,
          tabSize: settings.tabSize,
          detectIndentation: settings.detectIndentation,
          insertSpaces: settings.insertSpaces,
          lineNumbers: settings.lineNumbers,
          folding: settings.folding,
          links: settings.links,
          contextmenu: true,
          mouseWheelZoom: settings.mouseWheelZoom,
          find: { addExtraSpaceOnTop: false, autoFindInSelection: "multiline" },
        }}
      />
    </div>
  );
}
