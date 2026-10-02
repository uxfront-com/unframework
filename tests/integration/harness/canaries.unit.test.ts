// The canaries' corruptions, on a component of their own: each one must change every target's
// output (a canary that changes nothing would pass and prove nothing), and only in the way its
// layer is meant to catch. The runner (`pnpm test:canaries`) then proves each layer catches it
// on every case of the corpus, and the verdict tests (canary-verdict.unit.test.ts) how it
// judges a run.
import { compile, TARGET_NAMES } from "@unframework/compiler";
import type { CompileResult, TargetName } from "@unframework/compiler";
import type { ProjectKind } from "@unframework/testing/node";
import { describe, expect, it } from "vitest";

import {
  addRootAttribute,
  CANARIES,
  canaryFormats,
  canaryPlugins,
  canaryProjects,
  canarySource,
  findCanary,
  guardsGoldens,
  injectScript,
  mismatchClosingTag,
} from "./canaries.ts";
import { formattingProblems, nondeterminism } from "./compile-checks.ts";
import { LIVE_LAYERS } from "./quarantine.ts";
import { REFERENCE } from "./targets.ts";

const filename = "fixture/greeting/Greeting.uf.tsx";
const source =
  'export default function Greeting() {\n  return <p class="greeting">Hello, world!</p>;\n}\n';

/** A compile as the compile project runs it under a canary: its source, plugins and format. */
function compileWith(
  id: string | null,
  target?: TargetName,
  input: string = source,
): Promise<CompileResult> {
  return compile(canarySource(id, input), {
    filename,
    targets: target ? [target] : TARGET_NAMES,
    plugins: canaryPlugins(id, target),
    format: canaryFormats(id),
  });
}

/** The kinds of project that verify each live layer (plan §7.3). */
const VERIFIED_BY: Record<string, readonly ProjectKind[]> = {
  L1: ["compile"],
  L2: ["compile"],
  L3: ["toolchain"],
  L4: ["toolchain"],
  L6: ["ssr"],
  L7: ["browser"],
  L10: ["browser"],
  L11: ["browser"],
  L13: ["ssr", "browser"],
};

describe("canaries", () => {
  it("cover every live layer, with unique ids", () => {
    expect(new Set(CANARIES.map((canary) => canary.layer))).toEqual(new Set(LIVE_LAYERS));
    expect(new Set(CANARIES.map((canary) => canary.id)).size).toBe(CANARIES.length);
  });

  it.each(CANARIES)("$id names the projects of its layer, each with a sub-check", (canary) => {
    expect(Object.keys(canary.evidence)).toEqual(VERIFIED_BY[canary.layer]);
    for (const checks of [
      ...Object.values(canary.evidence),
      ...Object.values(canary.loadEvidence ?? {}),
    ]) {
      expect(Object.keys(checks).length).toBeGreaterThan(0);
    }
    expect(canaryProjects(canary)).toEqual([
      ...new Set([...Object.keys(canary.evidence), ...Object.keys(canary.loadEvidence ?? {})]),
    ]);
  });

  it("prove the golden guard where it fails a spec's import, in the browser projects", () => {
    expect(canaryProjects(findCanary("L6-golden-guard"))).toEqual(["ssr", "browser"]);
  });

  it("corrupt a source or skip the format step only for the compile project", () => {
    const compileOnly = CANARIES.filter(
      (canary) => canary.source !== undefined || canary.format === false,
    );
    expect(compileOnly.map((canary) => canary.id)).toEqual([
      "L1-diagnostic-added",
      "L2-unformatted",
    ]);
    for (const canary of compileOnly) expect(canaryProjects(canary)).toEqual(["compile"]);
    expect(canarySource(null, source)).toBe(source);
    expect(canaryFormats(null)).toBe(true);
    expect(canaryFormats("L2-output-edited")).toBe(true);
  });

  it("refuse an unknown canary", () => {
    expect(() => findCanary("L5-lint")).toThrow(/Unknown canary "L5-lint"/);
    expect(canaryPlugins(null)).toEqual([]);
  });

  it("keep the golden guard on, except under a canary that changes outputs on purpose", () => {
    expect(guardsGoldens(null)).toBe(true);
    expect(guardsGoldens("L7-wrong-text")).toBe(false);
    expect(guardsGoldens("L6-golden-guard")).toBe(true);
  });

  it("L1 turns into an unexpected UF8001 on every target", async () => {
    const result = await compileWith("L1-plugin-throws");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UF8001"]);
    expect(result.diagnostics[0]!.target).toBeUndefined();
  });

  it("L1-diagnostic-added adds a UF1201, also to a source that has compile errors", async () => {
    const added = await compileWith("L1-diagnostic-added");
    expect(added.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UF1201"]);
    const rejected =
      'import { ref } from "vue";\n\nexport default function A() {\n  return <p />;\n}\n';
    const clean = await compileWith(null, undefined, rejected);
    const corrupted = await compileWith("L1-diagnostic-added", undefined, rejected);
    expect(clean.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UF1201"]);
    expect(corrupted.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "UF1201",
      "UF1201",
    ]);
    // The case's own diagnostic moves a line down.
    expect(corrupted.diagnostics[1]!.span.start).toBe(
      clean.diagnostics[0]!.span.start + 'import "react";\n'.length,
    );
  });

  it("L2-nondeterministic gives two compiles of one source different output", async () => {
    const [first, second] = await Promise.all([
      compileWith("L2-nondeterministic"),
      compileWith("L2-nondeterministic"),
    ]);
    for (const target of TARGET_NAMES) {
      expect(nondeterminism(first, second, target), target).toMatch(/^Compiling twice/);
    }
  });

  it("L2-unformatted output is not a fixed point of the formatter, on every target", async () => {
    const result = await compileWith("L2-unformatted");
    for (const target of TARGET_NAMES) {
      expect(await formattingProblems(target, result.outputs[target]!), target).toEqual([
        expect.stringMatching(/ is not formatted idempotently:/),
      ]);
    }
  });

  it.each(CANARIES.filter((canary) => canary.layer !== "L1"))(
    "$id changes the output of every target it corrupts, without plugin errors",
    async (canary) => {
      const clean = await compileWith(null);
      for (const target of TARGET_NAMES) {
        const corrupted = await compileWith(canary.id, target);
        expect(corrupted.diagnostics.filter((diagnostic) => diagnostic.code === "UF8001")).toEqual(
          [],
        );
        if (canary.followersOnly && target === REFERENCE) {
          expect(corrupted.outputs[target], target).toEqual(clean.outputs[target]);
        } else {
          expect(corrupted.outputs[target], target).not.toEqual(clean.outputs[target]);
        }
      }
    },
  );

  it("L2-output-edited leaves the IR alone, so only the golden comparison can catch it", async () => {
    const clean = await compileWith(null);
    const corrupted = await compileWith("L2-output-edited");
    expect(corrupted.ir).toEqual(clean.ir);
    expect(corrupted.outputs).not.toEqual(clean.outputs);
  });

  it("needs the project's target for a canary that spares the reference", () => {
    expect(() => canaryPlugins("L10-root-hidden")).toThrow(/needs the project's target/);
    expect(canaryPlugins("L10-root-hidden", REFERENCE)).toEqual([]);
  });

  it("L13 puts the warning in every target's render path", async () => {
    const result = await compileWith("L13-console-warn");
    const contents = (target: string) => result.outputs[target]![0]!.contents;
    expect(contents("react")).toMatch(
      /function Greeting\(\) \{\s+console\.warn\("\[uf canary\] L13 in react"\);/,
    );
    expect(contents("solid")).toMatch(/function Greeting\(\) \{\s+console\.warn/);
    expect(contents("qwik")).toMatch(/component\$\(\(\) => \{\s+console\.warn/);
    expect(contents("vue")).toMatch(/<script setup lang="ts">\s*console\.warn/);
    expect(contents("svelte")).toMatch(/<script lang="ts">\s*console\.warn/);
    expect(contents("angular")).toMatch(/constructor\(\) \{\s+console\.warn/);
    expect(contents("astro")).toMatch(
      /^---\nconsole\.warn\("\[uf canary\] L13 in astro"\);\n---\n/,
    );
  });

  it("L10-root-inverted styles the root element in each target's own syntax", async () => {
    const result = await compileWith("L10-root-inverted", "react");
    expect(result.outputs.react![0]!.contents).toContain(
      '<p style={{ filter: "invert(1)" }} className="greeting">',
    );
    for (const target of TARGET_NAMES.filter((name) => name !== REFERENCE)) {
      const { outputs } = await compileWith("L10-root-inverted", target);
      const contents = outputs[target]![0]!.contents;
      expect(contents.match(/style=/g), target).toHaveLength(1);
      expect(contents, target).toMatch(
        /<p style=(?:"filter: invert\(1\)"|\{\{ filter: "invert\(1\)" \}\}) class/,
      );
    }
  });

  it("adds an attribute to the root element only, after any frontmatter or options", () => {
    const attribute = { jsx: "data-x={1}", markup: 'data-x="1"' };
    expect(
      addRootAttribute(
        {
          path: "Card.astro",
          contents: '---\nconst a = "<b>";\n---\n<article>\n  <p>a</p>\n</article>\n',
        },
        attribute,
      ),
    ).toBe('---\nconst a = "<b>";\n---\n<article data-x="1">\n  <p>a</p>\n</article>\n');
    expect(
      addRootAttribute(
        { path: "Card.svelte", contents: "<svelte:options runes={true} />\n\n<hr />\n" },
        attribute,
      ),
    ).toBe('<svelte:options runes={true} />\n\n<hr data-x="1" />\n');
    expect(
      addRootAttribute(
        {
          path: "Card.tsx",
          contents:
            "export default function Card() {\n  return (\n    <div>\n      <p />\n    </div>\n  );\n}\n",
        },
        attribute,
      ),
    ).toContain("<div data-x={1}>\n      <p />");
    expect(() =>
      addRootAttribute({ path: "Card.vue", contents: "<script setup></script>\n" }, attribute),
    ).toThrow(/no template/);
    expect(() =>
      addRootAttribute({ path: "Card.vue", contents: "<template>text</template>\n" }, attribute),
    ).toThrow(/no root element/);
  });

  it("injects into an existing script block rather than adding a second one", () => {
    const vue = injectScript(
      {
        path: "A.vue",
        contents: '<script setup lang="ts">\nconst a = 1;\n</script>\n<template><p /></template>\n',
      },
      "vue",
      "x();",
      "render",
    );
    expect(vue.match(/<script/g)).toHaveLength(1);
    const astro = injectScript(
      { path: "A.astro", contents: "---\nconst a = 1;\n---\n<p />\n" },
      "astro",
      "x();",
      "render",
    );
    expect(astro).toBe("---\nx();\nconst a = 1;\n---\n<p />\n");
  });

  it("fails loudly when an output has no shape to corrupt", () => {
    expect(() =>
      mismatchClosingTag({ path: "A.vue", contents: "<template><br /></template>" }),
    ).not.toThrow();
    expect(() => mismatchClosingTag({ path: "A.svelte", contents: "<br />" })).toThrow(
      /no closing tag/,
    );
    expect(() =>
      injectScript(
        { path: "a.ts", contents: "export const a = 1;\n" },
        "angular",
        "x();",
        "render",
      ),
    ).toThrow(/no component class/);
  });

  it("renames a closing tag so it no longer matches", () => {
    expect(mismatchClosingTag({ path: "A.svelte", contents: "<p>a</p>" })).toBe("<p>a</span>");
    expect(mismatchClosingTag({ path: "A.svelte", contents: "<span>a</span>" })).toBe(
      "<span>a</div>",
    );
  });
});
