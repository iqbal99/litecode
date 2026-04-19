import { describe, expect, it, vi } from "vitest";

// Mock monaco
vi.mock("monaco-editor", () => ({
  languages: {
    registerDocumentFormattingEditProvider: vi.fn(),
    registerDocumentRangeFormattingEditProvider: vi.fn(),
  },
}));

import { bracketDelta, reindentBrackets, TokenizerState } from "./formatter";

describe("bracketDelta tokenizer", () => {
  it("should ignore brackets in single-quote strings", () => {
    const state: TokenizerState = { inBlockComment: false, inString: null };
    const { open, close } = bracketDelta("const s = '{'; }", state);
    expect(open).toBe(0);
    expect(close).toBe(1);
    expect(state.inString).toBe(null);
  });

  it("should ignore brackets in double-quote strings", () => {
    const state: TokenizerState = { inBlockComment: false, inString: null };
    const { open, close } = bracketDelta('const s = "}"; {', state);
    expect(open).toBe(1);
    expect(close).toBe(0);
    expect(state.inString).toBe(null);
  });

  it("should ignore brackets in template literals", () => {
    const state: TokenizerState = { inBlockComment: false, inString: null };
    const { open, close } = bracketDelta('const s = `{`; }', state);
    expect(open).toBe(0);
    expect(close).toBe(1);
    expect(state.inString).toBe(null);
  });

  it("should handle escaped quotes in strings", () => {
    const state: TokenizerState = { inBlockComment: false, inString: null };
    const { open, close } = bracketDelta('const s = "{\\""; {', state);
    expect(open).toBe(1);
    expect(close).toBe(0);
    expect(state.inString).toBe(null);
  });

  it("should ignore brackets in line comments", () => {
    const state: TokenizerState = { inBlockComment: false, inString: null };
    const { open, close } = bracketDelta('const x = 1; // { ignore this', state);
    expect(open).toBe(0);
    expect(close).toBe(0);
  });

  it("should ignore brackets in block comments", () => {
    const state: TokenizerState = { inBlockComment: false, inString: null };
    const { open, close } = bracketDelta('/* { */ {', state);
    expect(open).toBe(1);
    expect(close).toBe(0);
    expect(state.inBlockComment).toBe(false);
  });

  it("should track block comment state across lines", () => {
    const state: TokenizerState = { inBlockComment: false, inString: null };
    bracketDelta('/*', state);
    expect(state.inBlockComment).toBe(true);
    
    const { open, close } = bracketDelta(' { ignored } ', state);
    expect(open).toBe(0);
    expect(close).toBe(0);
    expect(state.inBlockComment).toBe(true);

    bracketDelta(' */ {', state);
    expect(state.inBlockComment).toBe(false);
  });
});

describe("reindentBrackets with tokenizer", () => {
  it("should format correctly with brackets in strings", () => {
    const input = 'function f() {\nconst s = "{";\nreturn s;\n}';
    const unit = "  ";
    const result = reindentBrackets(input, unit);
    const expected = 'function f() {\n  const s = "{";\n  return s;\n}';
    expect(result).toBe(expected);
  });
});
