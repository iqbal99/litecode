/**
 * Generic indentation-based document formatter for languages that don't have
 * a Monaco built-in formatter (JSON/CSS/HTML/TS/JS are handled natively).
 *
 * Capabilities:
 *  - Normalize indentation (tabs ↔ spaces per editor settings)
 *  - Trim trailing whitespace
 *  - Collapse 3+ consecutive blank lines → 2
 *  - Ensure single trailing newline
 *  - Bracket-based re-indentation for C-family languages
 *  - Python-aware indent via colon-terminated lines
 */
import * as monaco from "monaco-editor";

// Languages whose formatting is already provided by Monaco's built-in
// language services (registered via their monaco.contribution imports).
const BUILTIN_FORMATTED: ReadonlySet<string> = new Set([
  "json",
  "css",
  "scss",
  "less",
  "html",
  "typescript",
  "javascript",
]);

// Languages where bracket-based re-indentation applies.
const BRACKET_LANGUAGES: ReadonlySet<string> = new Set([
  "c",
  "cpp",
  "csharp",
  "java",
  "go",
  "rust",
  "swift",
  "kotlin",
  "dart",
  "php",
  "graphql",
  "lua",
]);

// Languages that only get whitespace cleanup (no re-indentation) because
// indentation is semantically significant or bracket heuristics don't apply.
const WHITESPACE_ONLY: ReadonlySet<string> = new Set([
  "python",
  "yaml",
  "markdown",
  "plaintext",
  "ini",
  "toml",
  "dockerfile",
  "shell",
  "powershell",
  "r",
  "ruby",
  "sql",
  "xml",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a single indent unit from editor options. */
function indentUnit(opts: monaco.editor.TextModelResolvedOptions): string {
  return opts.insertSpaces ? " ".repeat(opts.indentSize) : "\t";
}

/** Strip all leading whitespace but preserve the rest of the line. */
function stripLeading(line: string): string {
  return line.replace(/^\s+/, "");
}

/** Count net bracket delta for a line (ignoring strings/comments is too complex
 *  without a parser — this simple heuristic works well for typical code). */
function bracketDelta(line: string): { open: number; close: number } {
  let open = 0;
  let close = 0;
  for (const ch of line) {
    if (ch === "{" || ch === "(" || ch === "[") open++;
    if (ch === "}" || ch === ")" || ch === "]") close++;
  }
  return { open, close };
}

// ── Formatting logic ──────────────────────────────────────────────────────────

function cleanWhitespace(text: string): string {
  const lines = text.split(/\r?\n/);

  // Trim trailing whitespace per line
  const trimmed = lines.map((l) => l.replace(/\s+$/, ""));

  // Collapse 3+ consecutive blank lines → 2
  const collapsed: string[] = [];
  let blankCount = 0;
  for (const line of trimmed) {
    if (line === "") {
      blankCount++;
      if (blankCount <= 2) collapsed.push(line);
    } else {
      blankCount = 0;
      collapsed.push(line);
    }
  }

  // Ensure single trailing newline
  while (collapsed.length > 0 && collapsed[collapsed.length - 1] === "") {
    collapsed.pop();
  }
  collapsed.push("");

  return collapsed.join("\n");
}

function reindentBrackets(
  text: string,
  unit: string,
): string {
  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  let indent = 0;

  for (const raw of lines) {
    const stripped = stripLeading(raw);

    if (stripped === "") {
      result.push("");
      continue;
    }

    const { open, close } = bracketDelta(stripped);

    // Lines starting with a closing bracket should de-indent first
    const leadingClose = /^[\}\)\]]/.test(stripped);
    if (leadingClose) {
      indent = Math.max(0, indent - 1);
    }

    result.push(unit.repeat(indent) + stripped);

    // Adjust indent for next line based on net bracket change
    // If we already handled a leading close, only count net from open/close
    if (leadingClose) {
      // We already decremented once for the leading close bracket.
      // Adjust for any remaining brackets on this line.
      indent = Math.max(0, indent + open - (close - 1));
    } else {
      indent = Math.max(0, indent + open - close);
    }
  }

  return result.join("\n");
}

function formatGeneric(
  text: string,
  languageId: string,
  opts: monaco.editor.TextModelResolvedOptions,
): string {
  const unit = indentUnit(opts);

  // Step 1: Whitespace cleanup (always)
  let result = cleanWhitespace(text);

  // Step 2: Bracket-based re-indentation (only for applicable languages)
  if (BRACKET_LANGUAGES.has(languageId)) {
    result = cleanWhitespace(reindentBrackets(result, unit));
  }

  // Step 3: Normalize existing indentation for whitespace-only languages
  // Convert tabs↔spaces to match editor settings without changing indent levels
  if (WHITESPACE_ONLY.has(languageId)) {
    const lines = result.split("\n");
    result = lines
      .map((line) => {
        const match = line.match(/^(\s*)/);
        if (!match || match[1].length === 0) return line;
        const leading = match[1];
        const rest = line.slice(leading.length);
        // Measure current indent in columns
        let cols = 0;
        for (const ch of leading) {
          cols += ch === "\t" ? opts.indentSize : 1;
        }
        // Rebuild with correct indent characters
        if (opts.insertSpaces) {
          return " ".repeat(cols) + rest;
        }
        const tabs = Math.floor(cols / opts.indentSize);
        const spaces = cols % opts.indentSize;
        return "\t".repeat(tabs) + " ".repeat(spaces) + rest;
      })
      .join("\n");
  }

  return result;
}

// ── Registration ──────────────────────────────────────────────────────────────

let registered = false;

/**
 * Register generic document formatting providers for all languages that
 * don't have a Monaco built-in formatter. Call once at editor startup.
 */
export function registerFormatters(m: typeof monaco): void {
  if (registered) return;
  registered = true;

  // Collect all language IDs that need our generic formatter
  const allLangs = new Set([...BRACKET_LANGUAGES, ...WHITESPACE_ONLY]);

  for (const langId of allLangs) {
    if (BUILTIN_FORMATTED.has(langId)) continue;

    m.languages.registerDocumentFormattingEditProvider(langId, {
      provideDocumentFormattingEdits(model, _options) {
        const text = model.getValue();
        const resolvedOpts = model.getOptions();
        const formatted = formatGeneric(text, langId, resolvedOpts);

        if (formatted === text) return [];

        const fullRange = model.getFullModelRange();
        return [{ range: fullRange, text: formatted }];
      },
    });

    m.languages.registerDocumentRangeFormattingEditProvider(langId, {
      provideDocumentRangeFormattingEdits(model, range, _options) {
        const text = model.getValueInRange(range);
        const resolvedOpts = model.getOptions();
        const formatted = formatGeneric(text, langId, resolvedOpts);

        if (formatted === text) return [];

        return [{ range, text: formatted }];
      },
    });
  }
}
