// C12's detectors, on pages made up here: the `harness` project has no browser, and CI runs
// `storybook:check` itself only from a later layer.
import { describe, expect, it } from "vitest";

import {
  catalogueProblems,
  isSpecChunk,
  noOutputStories,
  parseCommand,
  runnerProblems,
  storyProblem,
} from "./storybook-check.ts";
import type { StoryPage } from "./storybook-check.ts";

const page = (overrides: Partial<StoryPage> = {}): StoryPage => ({
  finished: true,
  showsError: false,
  errorMessage: undefined,
  noPreview: false,
  root: { elements: 1, content: "Hello" },
  noOutput: false,
  text: "Hello",
  ...overrides,
});

describe("storyProblem", () => {
  it("passes a story that rendered something", () => {
    expect(storyProblem(page())).toBeUndefined();
  });

  it.each([
    ["text alone", { elements: 0, content: "Hello" }],
    ["an element with no text", { elements: 1, content: "" }],
  ])("passes a root that holds %s", (_what, root) => {
    expect(storyProblem(page({ root }))).toBeUndefined();
  });

  it.each([
    ["no children", { elements: 0, content: "" }],
    ["only whitespace", { elements: 0, content: " \n " }],
    ["no root at all", undefined],
  ])("calls a root with %s empty", (_what, root) => {
    expect(storyProblem(page({ root }))).toBe("its root is empty");
  });

  it("reports the error display, with its message when it has one", () => {
    expect(storyProblem(page({ showsError: true, errorMessage: "boom" }))).toBe("boom");
    expect(storyProblem(page({ showsError: true }))).toBe("the error display is showing");
  });

  it("reports a story Storybook has no preview of, or that never finished", () => {
    expect(storyProblem(page({ noPreview: true }))).toBe("Storybook has no preview of it");
    expect(storyProblem(page({ finished: false }))).toBe("it did not finish rendering");
  });

  it("names why it didn't render ahead of what that left empty", () => {
    const root = { elements: 0, content: "" };
    expect(storyProblem(page({ root, showsError: true, errorMessage: "boom" }))).toBe("boom");
  });
});

describe("runnerProblems", () => {
  const empty = { elements: 0, content: "" };

  it("passes a runner that rendered nothing and can run a spec", () => {
    expect(runnerProblems("r", page({ root: empty }), "__run", true)).toEqual([]);
  });

  it("refuses one that rendered something, failed, or sets no way to run a spec", () => {
    expect(runnerProblems("r", page(), "__run", true)).toEqual(["r: it rendered something"]);
    expect(runnerProblems("r", page({ root: empty, showsError: true }), "__run", true)).toEqual([
      "r: the error display is showing",
    ]);
    expect(runnerProblems("r", page({ root: empty }), "__run", false)).toEqual([
      "r: it doesn't set __run",
    ]);
  });
});

describe("catalogueProblems", () => {
  const stories = [
    { id: "a-b--one", title: "a/b" },
    { id: "a-c--one", title: "a/c" },
  ];
  const pages = (entries: Record<string, StoryPage>) => new Map(Object.entries(entries));
  const fine = pages({ "a-b--one": page(), "a-c--one": page() });

  it("passes a build that matches the generator, with nothing wrong", () => {
    expect(catalogueProblems({ stories, pages: fine, noOutput: [], specChunks: [] })).toEqual([]);
  });

  it("names a story the build lacks, and one the generator lacks", () => {
    expect(
      catalogueProblems({
        stories,
        pages: pages({ "a-b--one": page(), "a-z--one": page() }),
        noOutput: [],
        specChunks: [],
      }),
    ).toEqual([
      "a-c--one: the generator lists it, the build lacks it",
      "a-z--one: the build holds it, the generator lacks it",
    ]);
  });

  it("names each story that errors or is empty, and goes on to the next", () => {
    expect(
      catalogueProblems({
        stories,
        pages: pages({
          "a-b--one": page({ showsError: true, errorMessage: "boom" }),
          "a-c--one": page({ root: { elements: 0, content: "" } }),
        }),
        noOutput: [],
        specChunks: [],
      }),
    ).toEqual(["a-b--one: boom", "a-c--one: its root is empty"]);
  });

  it("holds the no-output stories to the list, in both directions", () => {
    const showing = pages({ "a-b--one": page({ noOutput: true }), "a-c--one": page() });
    expect(noOutputStories(showing)).toEqual(["a-b--one"]);
    expect(
      catalogueProblems({ stories, pages: showing, noOutput: ["a/b"], specChunks: [] }),
    ).toEqual([]);
    expect(catalogueProblems({ stories, pages: showing, noOutput: [], specChunks: [] })).toEqual([
      "a/b: a story says it has no output, and it has",
    ]);
    expect(catalogueProblems({ stories, pages: fine, noOutput: ["a/c"], specChunks: [] })).toEqual([
      "a/c: it has no output, and no story says so",
    ]);
  });

  it("refuses a walk that loaded a spec", () => {
    expect(
      catalogueProblems({
        stories,
        pages: fine,
        noOutput: [],
        specChunks: ["http://x/a.test-1.js"],
      }),
    ).toEqual(["the catalogue loaded a spec: http://x/a.test-1.js"]);
  });
});

describe("isSpecChunk", () => {
  it("knows a spec's chunk from a story's or a component's", () => {
    expect(isSpecChunk("/assets/counter.test-7717CpBv.js")).toBe(true);
    expect(isSpecChunk("/assets/state-counter.stories-CsG2M2y-.js")).toBe(false);
    expect(isSpecChunk("/assets/Counter.uf.tsx-BXGNGKcy.js")).toBe(false);
    expect(isSpecChunk("/assets/counter.test-7717CpBv.css")).toBe(false);
  });
});

describe("parseCommand", () => {
  it("reads each command, with and without its flag", () => {
    expect(parseCommand(["build", "vue"])).toEqual({
      command: "build",
      target: "vue",
      value: undefined,
    });
    expect(parseCommand(["check", "vue"]).value).toBeUndefined();
    expect(parseCommand(["check", "vue", "--story", "a--b"]).value).toBe("a--b");
    expect(parseCommand(["serve", "vue", "--cases", "a/b", "c/d"]).value).toBe("a/b,c/d");
    expect(parseCommand(["serve", "vue", "--cases", "a/b,c/d"]).value).toBe("a/b,c/d");
  });

  it("skips the `--` pnpm may pass on", () => {
    expect(parseCommand(["check", "--", "vue", "--story", "a--b"]).value).toBe("a--b");
  });

  it.each([
    ["no command", []],
    ["no target", ["check"]],
    ["an unknown command", ["walk", "vue"]],
    [
      "a flag in its = form, which would walk the build",
      ["check", "vue", "--story=no-such--story"],
    ],
    ["a stray argument, which would walk the build", ["check", "vue", "state-counter--initial"]],
    ["--cases in its = form, which would serve every story", ["serve", "vue", "--cases=a/b"]],
    ["another command's flag", ["check", "vue", "--cases", "a/b"]],
    ["a second flag", ["check", "vue", "--story", "a--b", "--cases", "c/d"]],
    ["anything after build", ["build", "vue", "--story", "a--b"]],
  ])("refuses %s, with the usage", (_what, argv) => {
    expect(() => parseCommand(argv)).toThrow("Usage: storybook.ts");
  });

  it("refuses a flag with no value, and a target that isn't one", () => {
    expect(() => parseCommand(["check", "vue", "--story"])).toThrow("--story needs a value.");
    expect(() => parseCommand(["build", "nope"])).toThrow(
      "UF_TARGETS names unknown target(s): nope",
    );
  });
});
