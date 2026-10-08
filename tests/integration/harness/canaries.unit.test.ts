// The canaries' corruptions, on components of their own and on the corpus: each one must change
// every target's output of every case it is judged on (a canary that changes nothing would pass
// and prove nothing), keep the IR valid (a plugin whose IR breaks an invariant is a UF8001, and
// the targets emit the uncorrupted module instead), and change only what its layer is meant to
// catch. The runner (`pnpm test:canaries`) then proves each layer catches it on every case of
// the corpus, and the verdict tests (canary-verdict.unit.test.ts) how it judges a run.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { compile, TARGET_NAMES } from "@unframework/compiler";
import type { CompileResult, TargetName } from "@unframework/compiler";
import type { ElementNode, RenderNode, UfModule } from "@unframework/ir";
import type { ProjectKind } from "@unframework/testing/node";
import { describe, expect, it } from "vitest";

import { parseArguments, selectCanaries, shardCases, shardFilters } from "../scripts/canaries.ts";
import {
  addRootAttribute,
  CANARIES,
  canaryCase,
  canaryFixes,
  canaryFormats,
  canaryPlugins,
  canaryProjects,
  canarySource,
  corrupts,
  findCanary,
  guardsGoldens,
  injectScript,
  mismatchClosingTag,
  withQwikImports,
} from "./canaries.ts";
import type { Canary, CanaryCase } from "./canaries.ts";
import { listCases } from "./cases.ts";
import { checkFixes, formattingProblems, nondeterminism } from "./compile-checks.ts";
import { REPO_ROOT } from "./paths.ts";
import { LIVE_LAYERS } from "./quarantine.ts";
import { REFERENCE } from "./targets.ts";

const filename = "fixture/task-list/TaskList.uf.tsx";
/**
 * An M1-shaped component: local types (one generic, which Svelte's script keeps), props with
 * defaults (one with parentheses in it), a class binding, a conditional and a list.
 */
const source = `export interface Task {
  id: string;
  label: string;
}

export interface TaskListProps {
  title?: string;
  tasks: Array<Task>;
  done: boolean;
  tone?: "info" | "warning";
}

export default function TaskList({ title = "Tasks (today)", tasks, done, tone = "info" }: TaskListProps) {
  return (
    <section class={["task-list", tone]} aria-label={title}>
      <h2>{title}</h2>
      {done ? <p>All done.</p> : <p>Some left.</p>}
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>{task.label}</li>
        ))}
      </ul>
    </section>
  );
}
`;

/** A compile as the compile project runs it under a canary: its source, plugins and format. */
function compileWith(
  id: string | null,
  target?: TargetName,
  input: string = source,
  targets: readonly TargetName[] = target ? [target] : TARGET_NAMES,
): Promise<CompileResult> {
  return compile(canarySource(id, input), {
    filename,
    targets,
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
  L5: ["toolchain"],
  L6: ["ssr"],
  L7: ["browser"],
  L8: ["browser"],
  L9: ["browser"],
  L10: ["browser"],
  L11: ["browser"],
  L13: ["ssr", "browser"],
};

/** A case as the verdict sees it, for the fix canary. */
const fixture = (hasFixes: boolean): CanaryCase => ({
  id: "fixture/badge",
  hasOutput: () => true,
  spec: undefined,
  hasFixes: () => hasFixes,
  runs: () => true,
  interacts: () => false,
  rerenders: () => false,
  listens: false,
});

/** The elements of a render tree, in document order, through branches and list bodies. */
function elementsOf(nodes: readonly RenderNode[]): ElementNode[] {
  return nodes.flatMap((node): ElementNode[] => {
    if (node.kind === "Element") return [node, ...elementsOf(node.children)];
    if (node.kind === "If") return node.branches.flatMap((branch) => elementsOf(branch.children));
    if (node.kind === "For") return elementsOf([node.body]);
    return [];
  });
}

/** The root element of a module's first component. */
function rootElement(ir: UfModule | undefined): ElementNode {
  const render = ir?.components[0]?.render;
  if (render?.kind !== "Element") throw new Error("The component's root is no element.");
  return render;
}

/** The root element of a source's component, compiled clean under a canary. */
async function corruptedRoot(id: string, input: string): Promise<ElementNode> {
  const result = await compileWith(id, "react", input);
  expect(result.diagnostics).toEqual([]);
  return rootElement(result.ir);
}

/** An element's style declarations, as `property: value` (`…` for a bound value). */
function declarationsOf(element: ElementNode): string[] {
  return element.attributes.flatMap((attribute) =>
    attribute.kind === "Style"
      ? attribute.declarations.map(
          (declaration) =>
            `${declaration.property}: ${declaration.kind === "Static" ? declaration.value : "…"}`,
        )
      : [],
  );
}

/** The tags of the elements that hold the text canaries' marker, under L7-wrong-text. */
async function markedElements(input: string): Promise<string[]> {
  const render = (await compileWith("L7-wrong-text", "vue", input)).ir!.components[0]!.render;
  return elementsOf(render.kind === "Element" ? [render] : render.children)
    .filter(({ children }) =>
      children.some((child) => child.kind === "Text" && child.value.endsWith("(canary)")),
    )
    .map(({ tag }) => tag);
}

/** The targets a canary corrupts: every one, the followers, or the ones it names. */
function corruptedTargets(canary: Canary): TargetName[] {
  return (
    canary.followersOnly ? TARGET_NAMES.filter((name) => name !== REFERENCE) : [...TARGET_NAMES]
  ).filter((name) => corrupts(canary, name));
}

describe("canaries", () => {
  it("cover every live layer, with unique ids", () => {
    expect(new Set(CANARIES.map((canary) => canary.layer))).toEqual(new Set(LIVE_LAYERS));
    expect(new Set(CANARIES.map((canary) => canary.id)).size).toBe(CANARIES.length);
  });

  it.each(CANARIES)("$id names projects of its layer, each with a sub-check", (canary) => {
    // A canary of one framework's own code (Qwik's handlers) proves the projects where that code
    // runs; the layer's other canaries prove the rest (below).
    for (const kind of Object.keys(canary.evidence)) {
      expect(VERIFIED_BY[canary.layer]).toContain(kind);
    }
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

  it("prove every project of each live layer", () => {
    for (const layer of LIVE_LAYERS) {
      const proven = CANARIES.filter((canary) => canary.layer === layer).flatMap((canary) =>
        Object.keys(canary.evidence),
      );
      expect(new Set(proven), layer).toEqual(new Set(VERIFIED_BY[layer]));
    }
  });

  it("prove the golden guard where it fails a spec's import, in the browser projects", () => {
    expect(canaryProjects(findCanary("L6-golden-guard"))).toEqual(["ssr", "browser"]);
  });

  it("corrupt a source or the fixes, or skip the format step, only for the compile project", () => {
    const compileOnly = CANARIES.filter(
      (canary) =>
        canary.source !== undefined || canary.fixes !== undefined || canary.format === false,
    );
    expect(compileOnly.map((canary) => canary.id)).toEqual([
      "L1-diagnostic-added",
      "L1-fix-no-op",
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

  it("run in CI as a matrix: every canary once or in every shard, at most one browser canary per job, and shards for each whose browser specs run", () => {
    const workflow = readFileSync(join(REPO_ROOT, ".github", "workflows", "ci.yml"), "utf8");
    const job = workflow
      .slice(workflow.indexOf("\njobs:\n"))
      .split(/^ {2}(?=[a-z0-9-]+:\n)/m)
      .find((block) => block.startsWith("canaries:\n"));
    if (!job) throw new Error("ci.yml has no canaries job.");
    expect(job).toContain(
      "run: pnpm test:canaries ${{ matrix.canaries }}${{ matrix.shard && format(' --shard {0}', matrix.shard) || '' }}\n",
    );
    expect(job).toMatch(/^ {4}timeout-minutes: 10$/m);
    // An `include` entry a job: its canaries, and its shard if it has one.
    const include = /^ {8}include:\n((?: {10}.*\n)+)/m.exec(job)?.[1] ?? "";
    const entries = [
      ...include.matchAll(/^ {10}- canaries: (\S+)\n(?: {12}shard: (\S+)\n)?/gm),
    ].map(([, names, shard]) => ({
      name: `${names!}${shard ? ` --shard ${shard}` : ""}`,
      canaries: selectCanaries([names!]),
      shard: parseArguments(shard ? ["--shard", shard] : []).shard,
    }));
    // Every entry read: one in another shape would drop out of the checks below.
    expect(entries.length).toBe(include.match(/^ {10}- /gm)?.length);
    // Each canary runs once on every case, or in shards 1 to n of one count.
    const runs = new Map<string, string[]>();
    for (const { canaries, shard } of entries) {
      const part = shard ? `${shard.index}/${shard.count}` : "all";
      for (const { id } of canaries) runs.set(id, [...(runs.get(id) ?? []), part]);
    }
    expect([...runs.keys()].toSorted()).toEqual(CANARIES.map(({ id }) => id).toSorted());
    for (const [id, parts] of runs) {
      const { length } = parts;
      const whole = length === 1 ? ["all"] : parts.map((_, index) => `${index + 1}/${length}`);
      expect(parts.toSorted(), id).toEqual(whole.toSorted());
    }
    // A canary whose browser specs run waits out a timeout at most of their failures, on every
    // target: one job of the whole corpus outgrew the ten minutes (ADR-0052). The golden
    // guard's specs fail to load, so they run no test and wait for nothing.
    for (const { name, canaries, shard } of entries) {
      const browser = canaries.filter((canary) => canaryProjects(canary).includes("browser"));
      expect(browser.length, name).toBeLessThanOrEqual(1);
      if (browser.some(({ evidence }) => "browser" in evidence)) {
        expect(shard?.count ?? 1, name).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("take a shard, and run each case in exactly one of its parts", () => {
    expect(parseArguments(["--", "L8", "--shard", "1/2"])).toEqual({
      names: ["L8"],
      shard: { index: 1, count: 2 },
    });
    expect(parseArguments(["--shard=3/3", "L7", "L11"])).toEqual({
      names: ["L7", "L11"],
      shard: { index: 3, count: 3 },
    });
    expect(parseArguments(["L5"])).toEqual({ names: ["L5"], shard: undefined });
    for (const value of ["0/2", "3/2", "1", "a/b", ""]) {
      expect(() => parseArguments(["L8", "--shard", value]), value).toThrow(/--shard takes/);
    }
    expect(() => parseArguments(["L8", "--shard"])).toThrow(/--shard takes/);
    expect(() => parseArguments(["--shard", "1/2", "--shard=2/2"])).toThrow(/given twice/);

    // Every count-th case: an area's cases, and the specs among them, spread over the shards.
    expect(shardCases(["a/1", "a/2", "a/3", "b/1", "b/2"], { index: 2, count: 2 })).toEqual([
      "a/2",
      "b/1",
    ]);
    const cases = listCases().map(({ id }) => id);
    for (const count of [2, 3]) {
      const shards = Array.from({ length: count }, (_, index) =>
        shardCases(cases, { index: index + 1, count }),
      );
      expect(shards.flat().toSorted()).toEqual(cases.toSorted());
      const sizes = shards.map((shard) => shard.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
    expect(shardCases(cases, undefined)).toEqual(cases);
  });

  it("filter a shard's run to its cases' specs, and run every other project whole", () => {
    const cases = listCases().slice(0, 4).map(canaryCase);
    const shard = { index: 2, count: 2 };
    const specs = shardCases(cases, shard).flatMap((info) => (info.spec ? [info.spec] : []));
    expect(specs.length).toBeGreaterThan(0);
    expect(shardFilters(shardCases(cases, shard), shard)).toEqual(["harness/", ...specs]);
    expect(shardFilters(cases, undefined)).toEqual([]);
    // No spec path holds the filter the other projects' files match.
    for (const info of listCases().map(canaryCase))
      expect(info.spec ?? "").not.toContain("harness/");
  });

  it("are selected by id or by layer, and an unknown name or a layer without canaries throws", () => {
    expect(selectCanaries([]).length).toBe(CANARIES.length);
    expect(selectCanaries(["L5", "L13-console-warn"]).map(({ id }) => id)).toEqual([
      "L5-debugger",
      "L5-framework-rule",
      "L13-console-warn",
    ]);
    expect(selectCanaries(["L8", "L8-render-nothing"]).map(({ id }) => id)).toEqual([
      "L8-render-nothing",
    ]);
    expect(selectCanaries(["L9"]).map(({ id }) => id)).toEqual([
      "L9-unwired-handler",
      "L9-rerender-text",
    ]);
    expect(() => selectCanaries(["L12"])).toThrow("No canary proves L12: it is not live.");
    expect(() => selectCanaries(["L5-lint"])).toThrow(/Unknown canary "L5-lint"/);
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
    // A file that does not parse reports its syntax error alone, a line down: the evidence.
    const unparsed = "export default function A() {\n  return <p>a > b</p>;\n}\n";
    const syntax = await compileWith("L1-diagnostic-added", undefined, unparsed);
    expect(syntax.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UF1001"]);
    const { evidence } = findCanary("L1-diagnostic-added");
    const moved =
      'cases/x/__expected__/diagnostics.json differs from this run\'s output:\n-       "line": 2,\n+       "line": 3,';
    expect(evidence.compile!.diagnostics).toSatisfy((pattern: RegExp) => pattern.test(moved));
  });

  it("L1-fix-no-op leaves a fix's diagnostic in place, on the cases whose diagnostics have a fix", async () => {
    // `className` is UF3004, with a safe fix that renames it to `class`.
    const fixable =
      'export default function Badge() {\n  return <p className="badge">New</p>;\n}\n';
    const { diagnostics } = await compileWith(null, undefined, fixable);
    const recompile = async (fixed: string) =>
      (await compileWith(null, undefined, fixed)).diagnostics;
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UF3004"]);
    for (const target of TARGET_NAMES) {
      const corrupted = canaryFixes("L1-fix-no-op", fixture(true), target, fixable, diagnostics);
      // The diagnostics themselves are unchanged, so diagnostics.json still matches.
      expect(corrupted.map(({ fixes: _fixes, ...rest }) => rest)).toEqual(
        diagnostics.map(({ fixes: _fixes, ...rest }) => rest),
      );
      await expect(checkFixes(fixable, corrupted, target, recompile)).rejects.toThrow(
        /^Applying the fixes of UF3004 does not recompile clean:\n[\s\S]*\+ UF3004 /,
      );
      await expect(
        checkFixes(fixable, diagnostics, target, recompile),
        "the fix the canary corrupts works",
      ).resolves.toBeUndefined();
    }
    expect(canaryFixes("L1-fix-no-op", fixture(false), "vue", fixable, diagnostics)).toBe(
      diagnostics,
    );
    expect(canaryFixes(null, fixture(true), "vue", fixable, diagnostics)).toBe(diagnostics);
    expect(canaryFixes("L7-wrong-text", fixture(true), "vue", fixable, diagnostics)).toBe(
      diagnostics,
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

  // L9-unwired-handler's corruption needs a listener, which the fixture has none of: it has a
  // test of its own below.
  it.each(CANARIES.filter((canary) => canary.layer !== "L1" && canary.id !== "L9-unwired-handler"))(
    "$id changes the output of every target it corrupts, without plugin errors",
    async (canary) => {
      const clean = await compileWith(null);
      for (const target of TARGET_NAMES) {
        const corrupted = await compileWith(canary.id, target);
        expect(corrupted.diagnostics.filter((diagnostic) => diagnostic.code === "UF8001")).toEqual(
          [],
        );
        if (!corruptedTargets(canary).includes(target)) {
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

  it("L13 and L5-debugger put their statement in every target's render path", async () => {
    const result = await compileWith("L13-console-warn");
    const contents = (target: string) => result.outputs[target]![0]!.contents;
    expect(contents("react")).toMatch(
      /tone = "info",\n\}: TaskListProps\) \{\n {2}console\.warn\("\[uf canary\] L13 in react"\);/,
    );
    expect(contents("solid")).toMatch(
      /function TaskList\(rawProps: TaskListProps\) \{\n {2}console\.warn/,
    );
    expect(contents("qwik")).toMatch(
      /component\$<TaskListProps>\(\n {2}\(\{ title = "Tasks \(today\)", tasks, done, tone = "info" \}\) => \{\n {4}console\.warn/,
    );
    expect(contents("vue")).toMatch(/<script setup lang="ts">\nconsole\.warn/);
    expect(contents("svelte")).toMatch(/<script lang="ts">\n {2}console\.warn/);
    expect(contents("angular")).toMatch(
      /export default class TaskList \{\n {2}constructor\(\) \{\n {4}console\.warn/,
    );
    expect(contents("astro")).toMatch(
      /^---\nconsole\.warn\("\[uf canary\] L13 in astro"\);\nexport interface Task \{/,
    );
    const debug = await compileWith("L5-debugger");
    for (const target of TARGET_NAMES) {
      expect(debug.outputs[target]![0]!.contents.match(/\bdebugger;/g), target).toHaveLength(1);
    }
  });

  it("L13-qwik-handler-throws gives Qwik's component a throwing document listener, and changes no other target", async () => {
    const clean = await compileWith(null);
    const result = await compileWith("L13-qwik-handler-throws", "qwik");
    const contents = result.outputs.qwik![0]!.contents;
    const listener = [
      "    useOnDocument(",
      '      ["click", "pointerover", "keydown", "input", "focusin", "wheel"],',
      "      $(() => {",
      '        throw new Error("[uf canary] L13 in qwik");',
      "      }),",
      "    );",
      "",
    ].join("\n");
    // The import names what the listener calls; the listener opens the component's body.
    expect(contents).toMatch(
      /^import \{ component\$, \$, useOnDocument \} from "@qwik\.dev\/core";$/m,
    );
    expect(contents).toContain(`tone = "info" }) => {\n${listener}`);
    // Nothing else changed: the component's own code is as it was.
    expect(contents.replace(listener, "").replace(", $, useOnDocument", "")).toBe(
      clean.outputs.qwik![0]!.contents,
    );
    expect(canaryPlugins("L13-qwik-handler-throws", "react")).toEqual([]);
    for (const target of TARGET_NAMES.filter((name) => name !== "qwik")) {
      const other = await compileWith("L13-qwik-handler-throws", target);
      expect(other.outputs[target], target).toEqual(clean.outputs[target]);
    }
  });

  it("adds a name to Qwik's import only where it lacks it, in a multi-line import too", () => {
    const file = (contents: string) => ({ path: "A.tsx", contents });
    expect(
      withQwikImports(file('import { $, type QRL, component$ } from "@qwik.dev/core";\n'), [
        "$",
        "useOnDocument",
      ]),
    ).toBe('import { $, type QRL, component$, useOnDocument } from "@qwik.dev/core";\n');
    expect(
      withQwikImports(
        file('import {\n  component$,\n  useSignal,\n} from "@qwik.dev/core";\nconst a = 1;\n'),
        ["$"],
      ),
    ).toBe('import { component$, useSignal, $ } from "@qwik.dev/core";\nconst a = 1;\n');
    expect(() => withQwikImports(file("export {};\n"), ["$"])).toThrow(
      /A\.tsx \(qwik\) has no value import from "@qwik\.dev\/core"/,
    );
  });

  it("L5-framework-rule writes its framework's forbidden idiom on the root element", async () => {
    const result = await compileWith("L5-framework-rule");
    const root = (target: string) =>
      /<section\b[^>]*>/.exec(result.outputs[target]![0]!.contents)?.[0];
    expect(root("react")).toMatch(/^<section class="uf-canary" className=/);
    expect(root("solid")).toMatch(/^<section className="uf-canary" class=/);
    expect(root("qwik")).toMatch(/^<section className="uf-canary" class=/);
    expect(root("vue")).toMatch(/^<section v-html="'uf-canary'" class=/);
    expect(root("svelte")).toMatch(/^<section style:uf-canary="1" class=/);
    expect(root("angular")).toMatch(/^<section \*ngIf="true" class=/);
    expect(root("astro")).toMatch(/^<section set:html="uf-canary" class:list=/);
  });

  it("L10-root-inverted styles the root element in each target's own syntax", async () => {
    for (const target of TARGET_NAMES.filter((name) => name !== REFERENCE)) {
      const { outputs } = await compileWith("L10-root-inverted", target);
      const contents = outputs[target]![0]!.contents;
      expect(contents.match(/invert\(1\)/g), target).toHaveLength(1);
      expect(contents, target).toMatch(
        /<section\b[^>]*\bstyle=(?:"filter: invert\(1\)"|\{\{ filter: "invert\(1\)" \}\})/,
      );
    }
  });

  describe("on roots that already set what they set", () => {
    const styled =
      'export default function Tag({ label }: { label: string }) {\n  return (\n    <span role="note" style={{ display: "inline-block", filter: "none" }}>\n      {label}\n    </span>\n  );\n}\n';
    const icon =
      'export default function Icon({ label }: { label: string }) {\n  return (\n    <svg role="img" viewBox="0 0 24 24">\n      <title>{label}</title>\n      <circle cx="12" cy="12" r="10" />\n    </svg>\n  );\n}\n';
    it("replace the root's role, on an <svg> root too", async () => {
      for (const input of [styled, icon]) {
        const root = await corruptedRoot("L11-invalid-role", input);
        const roles = root.attributes.filter(
          (attribute) =>
            (attribute.kind === "Static" || attribute.kind === "Bound") &&
            attribute.name === "role",
        );
        expect(roles, root.tag).toEqual([
          expect.objectContaining({ kind: "Static", value: "uf-canary" }),
        ]);
      }
    });

    it("replace the root's own declaration of the property they style", async () => {
      const hidden = await corruptedRoot("L10-root-hidden", styled);
      const inverted = await corruptedRoot("L10-root-inverted", styled);
      expect(declarationsOf(hidden)).toEqual(["filter: none", "display: none"]);
      expect(declarationsOf(inverted)).toEqual(["display: inline-block", "filter: invert(1)"]);
      // An <svg> takes no `hidden`: it is hidden by a style of its own.
      expect(declarationsOf(await corruptedRoot("L10-root-hidden", icon))).toEqual([
        "display: none",
      ]);
    });
  });

  describe("the text canaries", () => {
    it("append to the root's text, where every render shows it", async () => {
      expect(await markedElements(source)).toEqual(["section"]);
    });

    it("reach the first element that holds text: an SVG <title>, a table's cell", async () => {
      const icon =
        'export default function Icon({ label }: { label: string }) {\n  return (\n    <svg role="img" viewBox="0 0 24 24">\n      <circle cx="12" cy="12" r="10" />\n      <title>{label}</title>\n    </svg>\n  );\n}\n';
      expect(await markedElements(icon)).toEqual(["title"]);
      const table =
        "export default function Scores({ score }: { score: number }) {\n  return (\n    <table>\n      <tbody>\n        <tr>\n          <td>{score}</td>\n        </tr>\n      </tbody>\n    </table>\n  );\n}\n";
      expect(await markedElements(table)).toEqual(["td"]);
    });

    it("mark every branch of a root fragment whose roots all sit in branches", async () => {
      const branches =
        "export default function State({ on }: { on: boolean }) {\n  return <>{on ? <b>On</b> : <i>Off</i>}</>;\n}\n";
      expect(await markedElements(branches)).toEqual(["b", "i"]);
    });

    it("merge with the text the element ends with, so no two texts are adjacent", async () => {
      const { ir, outputs } = await compileWith(
        "L6-wrong-text",
        "vue",
        "export default function A() {\n  return <p>Hello</p>;\n}\n",
      );
      expect(rootElement(ir).children).toEqual([
        expect.objectContaining({ kind: "Text", value: "Hello (canary)" }),
      ]);
      expect(outputs.vue![0]!.contents).toContain("<p>Hello (canary)</p>");
    });
  });

  it("L8-render-nothing renders an empty element and keeps only the prop bindings", async () => {
    const { ir, diagnostics } = await compileWith("L8-render-nothing");
    expect(diagnostics).toEqual([]);
    const component = ir!.components[0]!;
    expect(component.render).toMatchObject({
      kind: "Element",
      tag: "div",
      attributes: [],
      children: [],
    });
    expect(component.bindings.map(({ kind }) => kind)).toEqual(["prop", "prop", "prop", "prop"]);
    expect(component.props.map(({ name }) => name)).toEqual(["title", "tasks", "done", "tone"]);
    expect(component.setup).toEqual([]);
  });

  it("L8-render-nothing drops the setup but keeps the events and their binding", () => {
    // What it does to a component with setup and events, on an IR of the shape the analyser
    // makes (the plugin reads the kinds only).
    const module = {
      irVersion: 1,
      file: "a/b/C.uf.tsx",
      exports: [],
      types: [],
      components: [
        {
          name: "C",
          span: { start: 0, end: 1 },
          props: [],
          types: [],
          emits: { binding: "emit@1", events: [] },
          bindings: [
            { id: "label@0", name: "label", kind: "prop" },
            { id: "emit@1", name: "emit", kind: "emit" },
            { id: "count@2", name: "count", kind: "state" },
            { id: "add@3", name: "add", kind: "localFn" },
          ],
          setup: [{ kind: "State", binding: "count@2" }],
          render: {
            kind: "Element",
            tag: "p",
            attributes: [],
            children: [],
            span: { start: 0, end: 1 },
          },
        },
      ],
    } as unknown as UfModule;
    const plugin = findCanary("L8-render-nothing").plugin!();
    const corrupted = (plugin.ir as (module: UfModule) => UfModule)(module).components[0]!;
    expect(corrupted.setup).toEqual([]);
    expect(corrupted.emits).toEqual(module.components[0]!.emits);
    expect(corrupted.bindings.map(({ id }) => id)).toEqual(["label@0", "emit@1"]);
  });

  it("L9-unwired-handler removes every element listener, in branches and lists too", () => {
    const listener = (event: string) => ({
      kind: "Event",
      event,
      handler: { kind: "Function", binding: "add@3", span: { start: 0, end: 1 } },
      span: { start: 0, end: 1 },
    });
    const element = (tag: string, attributes: unknown[], children: unknown[] = []) => ({
      kind: "Element",
      tag,
      attributes,
      children,
      span: { start: 0, end: 1 },
    });
    const title = { kind: "Static", name: "title", value: "t", span: { start: 0, end: 1 } };
    const render = element(
      "div",
      [listener("click"), title],
      [
        element("button", [listener("keydown")]),
        {
          kind: "If",
          branches: [
            { children: [element("input", [listener("input")])], span: { start: 0, end: 1 } },
          ],
          span: { start: 0, end: 1 },
        },
        {
          kind: "For",
          body: element("li", [listener("click")]),
          span: { start: 0, end: 1 },
        },
      ],
    );
    const module = {
      components: [{ name: "C", render }],
    } as unknown as UfModule;
    const plugin = findCanary("L9-unwired-handler").plugin!();
    const corrupted = (plugin.ir as (module: UfModule) => UfModule)(module);
    expect(JSON.stringify(corrupted)).not.toContain('"Event"');
    // Everything else stays: the title, every element.
    expect(JSON.stringify(corrupted)).toContain('"title"');
    expect(JSON.stringify(corrupted).match(/"Element"/g)).toHaveLength(4);
    // The module the compiler handed over is left as it was.
    expect(JSON.stringify(module).match(/"Event"/g)).toHaveLength(4);
  });

  it("L9's canaries apply to the cases whose tests act or rerender, on the targets they run on", () => {
    const unwired = findCanary("L9-unwired-handler");
    const rerender = findCanary("L9-rerender-text");
    const acting = {
      ...fixture(false),
      interacts: (target: string) => target !== "astro",
      listens: true,
    };
    expect(unwired.followersOnly).toBe(true);
    expect(unwired.appliesTo!(acting, "react")).toBe(true);
    expect(unwired.appliesTo!(acting, "astro")).toBe(false);
    expect(unwired.appliesTo!({ ...acting, listens: false }, "react")).toBe(false);
    expect(unwired.appliesTo!({ ...acting, interacts: () => false }, "react")).toBe(false);
    expect(rerender.appliesTo!({ ...fixture(false), rerenders: () => true }, "astro")).toBe(true);
    expect(
      rerender.appliesTo!(
        { ...fixture(false), rerenders: (target) => target !== "astro" },
        "astro",
      ),
    ).toBe(false);
    expect(rerender.appliesTo!(fixture(false), "react")).toBe(false);
  });

  it("read which tests of a case run on each target, and which of those act or rerender", () => {
    const dir = mkdtempSync(join(tmpdir(), "uf-canary-case-"));
    try {
      const write = (path: string, contents: string) => {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), contents);
      };
      const input = "export default function Card() {\n  return <p>Card</p>;\n}\n";
      // A static test, a rerender that requires interactivity, and an action that requires
      // event-capture too (unsupported nowhere but where interactivity is).
      write("semantics/card/Card.uf.tsx", input);
      write(
        "semantics/card/card.test.ts",
        `it("renders", async () => {
  const view = await mount(Card);
  await view.expectParity("initial");
});
it("rerenders", { requires: ["interactivity"] }, async () => {
  const view = await mount(Card);
  await view.rerender({});
  await view.expectParity("rerendered");
});
it("clicks", { requires: ["interactivity", "event-capture"] }, async () => {
  const view = await mount(Card);
  await view.user.click(view.getByRole("button"));
  await view.expectParity("clicked");
});
`,
      );
      // Every test requires interactivity (a case.json requires case).
      write("lifecycle/mounted/Mounted.uf.tsx", input);
      write(
        "lifecycle/mounted/mounted.test.ts",
        `it("renders", { requires: ["interactivity"] }, async () => {
  const view = await mount(Mounted);
  await view.expectParity("initial");
});
`,
      );
      write("lifecycle/mounted/case.json", '{ "requires": "onMounted writes the status." }');
      const [mounted, card] = listCases(dir).map(canaryCase);
      expect([card!.runs("astro"), card!.rerenders("astro"), card!.interacts("astro")]).toEqual([
        true,
        false,
        false,
      ]);
      expect([card!.runs("react"), card!.rerenders("react"), card!.interacts("react")]).toEqual([
        true,
        true,
        true,
      ]);
      expect([mounted!.runs("astro"), mounted!.runs("solid")]).toEqual([false, true]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rename the last closing tag of each target's template, never a script block's", async () => {
    const result = await compileWith("L3-mismatched-closing-tag");
    for (const target of TARGET_NAMES) {
      const contents = result.outputs[target]![0]!.contents;
      expect(contents.match(/<\/span>/g), target).toHaveLength(1);
      expect(contents, target).not.toContain("</section>");
    }
    for (const target of ["vue", "svelte"]) {
      expect(result.outputs[target]![0]!.contents, target).toContain("</script>");
    }
    expect(result.outputs.vue![0]!.contents).toMatch(/<\/span>\n<\/template>\n$/);
  });

  it("add an attribute to the root element only, after any frontmatter, options or script", () => {
    const attribute = 'data-x="1"';
    expect(
      addRootAttribute(
        {
          path: "Card.astro",
          contents:
            '---\nconst a: Array<string> = ["<b>"];\n---\n<article>\n  <p>a</p>\n</article>\n',
        },
        attribute,
      ),
    ).toBe(
      '---\nconst a: Array<string> = ["<b>"];\n---\n<article data-x="1">\n  <p>a</p>\n</article>\n',
    );
    expect(
      addRootAttribute(
        {
          path: "Card.svelte",
          contents:
            '<svelte:options runes={true} />\n\n<script lang="ts">\n  let { a }: { a: Array<string> } = $props();\n</script>\n\n<hr />\n',
        },
        attribute,
      ),
    ).toMatch(/<\/script>\n\n<hr data-x="1" \/>\n$/);
    expect(
      addRootAttribute(
        { path: "Card.svelte", contents: "<svelte:options runes={true} />\n\n<hr />\n" },
        attribute,
      ),
    ).toBe('<svelte:options runes={true} />\n\n<hr data-x="1" />\n');
    expect(
      addRootAttribute(
        {
          path: "Card.vue",
          contents:
            '<script setup lang="ts">\nconst a: Array<string> = [];\n</script>\n\n<template>\n  <template v-if="a.length"><p>a</p></template>\n</template>\n',
        },
        attribute,
      ),
    ).toContain('<template v-if="a.length"><p data-x="1">a</p></template>');
    expect(
      addRootAttribute(
        {
          path: "Card.tsx",
          contents:
            'import { component$ } from "@qwik.dev/core";\n\nexport default component$<{ a: Array<string> }>(({ a }) => {\n  return (\n    <div>\n      <p />\n    </div>\n  );\n});\n',
        },
        "data-x={1}",
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

  it("injects into a component body whose parameters hold parentheses of their own", () => {
    const react = injectScript(
      {
        path: "A.tsx",
        contents:
          'export default function A({ label = "(a)", format }: { label?: string; format: () => string }) {\n  return <p>{format()}</p>;\n}\n',
      },
      "react",
      "x();",
      "render",
    );
    expect(react).toContain("format: () => string }) {\n  x();\n  return <p>");
    const qwik = injectScript(
      {
        path: "A.tsx",
        contents:
          'import { component$ } from "@qwik.dev/core";\n\nexport default component$<{ label?: string }>(\n  ({ label = ")" }) => {\n    return <p>{label}</p>;\n  },\n);\n',
      },
      "qwik",
      "x();",
      "render",
    );
    expect(qwik).toContain('({ label = ")" }) => {\n  x();\n    return <p>');
    expect(() =>
      injectScript(
        {
          path: "A.tsx",
          contents:
            'import { component$ } from "@qwik.dev/core";\n\nexport default component$(() => <p />);\n',
        },
        "qwik",
        "x();",
        "render",
      ),
    ).toThrow(/no component\$ body/);
    const angular = injectScript(
      {
        path: "a.ts",
        contents: "export default class A {\n  readonly label = input.required<string>();\n}\n",
      },
      "angular",
      "x();",
      "render",
    );
    expect(angular).toBe(
      "export default class A {\n  constructor() {\n    x();\n  }\n\n  readonly label = input.required<string>();\n}\n",
    );
    // A class with a constructor of its own (M2's effects and hooks) gets it first in its body.
    const withConstructor = injectScript(
      {
        path: "a.ts",
        contents:
          "export default class A {\n  readonly label = input.required<string>();\n\n  constructor() {\n    effect(() => this.label());\n  }\n}\n",
      },
      "angular",
      "x();",
      "render",
    );
    expect(withConstructor).toBe(
      "export default class A {\n  readonly label = input.required<string>();\n\n  constructor() {\n    x();\n    effect(() => this.label());\n  }\n}\n",
    );
  });

  it("fails loudly when an output has no shape to corrupt", () => {
    // The template's own end is no tag of its markup.
    expect(() =>
      mismatchClosingTag({ path: "A.vue", contents: "<template><br /></template>" }),
    ).toThrow(/no closing tag/);
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

  it("renames a closing tag of the markup so it no longer matches", () => {
    expect(mismatchClosingTag({ path: "A.svelte", contents: "<p>a</p>" })).toBe("<p>a</span>");
    expect(mismatchClosingTag({ path: "A.svelte", contents: "<span>a</span>" })).toBe(
      "<span>a</div>",
    );
    expect(
      mismatchClosingTag({
        path: "A.svelte",
        contents:
          '<script lang="ts">\n  let a: Array<string> = [];\n</script>\n\n<p title="</b>">a</p>\n',
      }),
    ).toBe(
      '<script lang="ts">\n  let a: Array<string> = [];\n</script>\n\n<p title="</b>">a</span>\n',
    );
    expect(
      mismatchClosingTag({
        path: "a.ts",
        contents: "@Component({\n  template: `<p>a</p>`,\n})\nexport default class A {}\n// </b>\n",
      }),
    ).toBe("@Component({\n  template: `<p>a</span>`,\n})\nexport default class A {}\n// </b>\n");
  });
});

describe("every canary on the corpus", () => {
  const cases = listCases();
  const compiled = new Map<string, Promise<{ input: string; result: CompileResult }>>();
  /** A case's source and its clean compile, once per run. */
  const clean = (info: (typeof cases)[number]) => {
    let pending = compiled.get(info.id);
    if (!pending) {
      const input = readFileSync(info.source, "utf8");
      pending = compile(input, { filename: info.filename, targets: TARGET_NAMES }).then(
        (result) => ({ input, result }),
      );
      compiled.set(info.id, pending);
    }
    return pending;
  };

  it.each(CANARIES.filter((canary) => canary.plugin && canary.id !== "L1-plugin-throws"))(
    "$id corrupts every case with output on every target it corrupts, keeping the IR valid",
    async (canary) => {
      const problems: string[] = [];
      for (const info of cases) {
        const { input, result } = await clean(info);
        // Only the cases it applies to on each target: the verdict judges no other.
        const applies = canaryCase(info);
        const targets = corruptedTargets(canary).filter(
          (target) =>
            result.outputs[target]?.length &&
            (!canary.appliesTo || canary.appliesTo(applies, target)) &&
            !result.diagnostics.some(
              (diagnostic) =>
                diagnostic.severity === "error" &&
                (diagnostic.target === undefined || diagnostic.target === target),
            ),
        );
        if (!targets.length) continue;
        const after = await compile(input, {
          filename: info.filename,
          targets,
          plugins: canaryPlugins(canary.id, targets[0]),
          format: canaryFormats(canary.id),
        });
        for (const diagnostic of after.diagnostics.filter(({ code }) => code === "UF8001")) {
          problems.push(`${info.id}: ${diagnostic.message}`);
        }
        for (const target of targets) {
          if (JSON.stringify(after.outputs[target]) === JSON.stringify(result.outputs[target])) {
            problems.push(`${info.id} › ${target}: the output did not change`);
          }
        }
      }
      expect(problems).toEqual([]);
    },
  );
});
