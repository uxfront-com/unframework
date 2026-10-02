import { describe, expect, it } from "vitest";

import { diffLines } from "../src/diff.ts";
import { formatError } from "../src/errors.ts";

describe("diffLines", () => {
  it("is empty for equal texts", () => {
    expect(diffLines("a\nb", "a\nb")).toBe("");
  });

  it("shows removed and added lines with context", () => {
    const expected = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].join("\n");
    const actual = ["1", "2", "3", "4", "five", "6", "7", "8", "9"].join("\n");
    expect(diffLines(expected, actual, { context: 1 })).toBe(
      ["- expected", "+ actual", "  4", "- 5", "+ five", "  6"].join("\n"),
    );
  });

  it("separates distant changes", () => {
    const expected = ["a", "1", "2", "3", "4", "5", "z"].join("\n");
    const actual = ["A", "1", "2", "3", "4", "5", "Z"].join("\n");
    const diff = diffLines(expected, actual, { context: 1 }).split("\n");
    expect(diff).toEqual([
      "- expected",
      "+ actual",
      "- a",
      "+ A",
      "  1",
      "  …",
      "  5",
      "- z",
      "+ Z",
    ]);
  });

  it("makes trailing whitespace visible", () => {
    expect(diffLines("a", "a  ")).toContain("+ a··");
  });

  it("summarises diffs longer than the limit", () => {
    const expected = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const actual = Array.from({ length: 50 }, (_, i) => `LINE ${i}`).join("\n");
    const diff = diffLines(expected, actual, { maxLines: 10 }).split("\n");
    expect(diff).toHaveLength(13);
    expect(diff.at(-1)).toBe("  … 90 more diff line(s)");
  });

  it("falls back to the first change for very large inputs", () => {
    const expected = Array.from({ length: 3000 }, (_, i) => `${i}`).join("\n");
    const actual = `${expected}\nextra`;
    const diff = diffLines(`${expected}\nold`, actual, { context: 0 });
    expect(diff).toContain("- old");
    expect(diff).toContain("+ extra");
  });
});

describe("formatError", () => {
  it("returns the message of an error and the text of anything else", () => {
    expect(formatError(new Error("boom"))).toBe("boom");
    expect(formatError("plain")).toBe("plain");
  });

  it("adds a diff to string assertion errors with several lines", () => {
    let caught: unknown;
    try {
      expect("a\nb").toBe("a\nc");
    } catch (error) {
      caught = error;
    }
    expect(formatError(caught)).toContain("- c\n+ b");
  });
});
