import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
// Must be imported to register the TypeScript/JavaScript language contributions
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";

// ── Tell @monaco-editor/react to use this bundled Monaco instance ─────────────
// Without this, the React wrapper loads a *separate* Monaco from CDN, which means
// our workers, models, and language service configs are all on the wrong instance.
loader.config({ monaco });

// ── Web Workers ───────────────────────────────────────────────────────────────
window.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less")
      return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor")
      return new htmlWorker();
    if (label === "typescript" || label === "javascript")
      return new tsWorker();
    return new editorWorker();
  },
};

// ── TypeScript / JavaScript Language Service ──────────────────────────────────
// In Monaco ≥ 0.52 the contribution types were removed from editor.api.d.ts.
// The side-effect import above registers the language; properties exist at runtime.
// We access them through (monaco.languages as any).typescript to avoid the
// deprecated-typed stub that only has { deprecated: true }.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tsLang = (monaco.languages as any).typescript as {
  typescriptDefaults: {
    setCompilerOptions(opts: Record<string, unknown>): void;
    setDiagnosticsOptions(opts: Record<string, unknown>): void;
    setEagerModelSync(value: boolean): void;
  };
  javascriptDefaults: {
    setCompilerOptions(opts: Record<string, unknown>): void;
    setDiagnosticsOptions(opts: Record<string, unknown>): void;
    setEagerModelSync(value: boolean): void;
  };
  JsxEmit: Record<string, number>;
  ScriptTarget: Record<string, number>;
  ModuleKind: Record<string, number>;
  ModuleResolutionKind: Record<string, number>;
};

const sharedCompilerOptions = {
  // JSX — needed for .tsx / .jsx syntax highlighting + completions
  jsx: tsLang.JsxEmit["ReactJSX"] ?? 4,
  // Targets & modules
  target: tsLang.ScriptTarget["ESNext"] ?? 99,
  module: tsLang.ModuleKind["ESNext"] ?? 99,
  moduleResolution: tsLang.ModuleResolutionKind["NodeJs"] ?? 2,
  // Interop
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  allowJs: true,
  // Lib: DOM + modern ES so built-in completions (Array, Promise, …) work
  lib: ["esnext", "dom", "dom.iterable"],
  // Relaxed strictness — don't flood a code editor with TS errors
  strict: false,
  noImplicitAny: false,
  strictNullChecks: false,
};

tsLang.typescriptDefaults.setCompilerOptions(sharedCompilerOptions);
tsLang.javascriptDefaults.setCompilerOptions(sharedCompilerOptions);

// Sync all open models so cross-file type info and completions work
tsLang.typescriptDefaults.setEagerModelSync(true);
tsLang.javascriptDefaults.setEagerModelSync(true);

// Show diagnostics as squiggles; only validate the visible model for perf
tsLang.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
  onlyVisible: true,
});
tsLang.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
  onlyVisible: true,
});
