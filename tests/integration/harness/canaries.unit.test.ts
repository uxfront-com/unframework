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

// The unplugin's join, by path: it is internal to the package, and the canary must survive it.
import { joinModules } from "../../../packages/unplugin/src/assemble.ts";
import {
  canaryRuns,
  combineRuns,
  parseArguments,
  selectCanaries,
  shardCases,
  shardFilters,
} from "../scripts/canaries.ts";
import {
  addRootAttribute,
  anyExportedTypes,
  CANARIES,
  canaryCase,
  dropFirstRule,
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
import { CASES_DIR, REPO_ROOT } from "./paths.ts";
import { LIVE_LAYERS } from "./quarantine.ts";
import { caseResolver } from "./sources.ts";
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

/** Code's lines without their indentation, and without blank ones. */
function trimmedLines(code: string): string[] {
  return code
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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
  styled: false,
  reference: REFERENCE,
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

  it("corrupt each output of a joined module apart with L6-golden-guard, so the join keeps it", async () => {
    // Two components of one `.uf.tsx`, whose outputs the unplugin joins into one module.
    const path = "components/local-sibling/Card.uf.tsx";
    const input = readFileSync(join(CASES_DIR, path), "utf8");
    const compiled = (id: string | null) =>
      compile(canarySource(id, input), {
        filename: path,
        targets: ["solid"],
        plugins: canaryPlugins(id, "solid"),
        format: canaryFormats(id),
      });
    const [clean, guarded] = await Promise.all([compiled(null), compiled("L6-golden-guard")]);
    const files = guarded.outputs.solid!;
    expect(files).toHaveLength(2);
    for (const [index, file] of files.entries()) {
      expect(file.contents).not.toBe(clean.outputs.solid![index]!.contents);
    }
    expect(
      joinModules(
        files,
        path,
        files.map((file) => file.path),
      ),
    ).not.toHaveProperty("error");
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

  it("run each project whose specs fail to load in a Vitest run of its own, named for it", () => {
    const shard = { index: 2, count: 2 };
    const cases = shardCases(listCases().slice(0, 4).map(canaryCase), shard);
    const filters = shardFilters(cases, shard);
    expect(canaryRuns(findCanary("L6-golden-guard"), TARGET_NAMES, cases, shard)).toEqual([
      { name: "ssr", args: ["--project", "ssr:*", ...filters] },
      ...TARGET_NAMES.map((target) => ({
        name: `browser-${target}`,
        args: ["--project", `browser:${target}`, ...filters],
      })),
    ]);
    expect(canaryRuns(findCanary("L6-golden-guard"), ["vue", "angular"], cases, undefined)).toEqual(
      [
        { name: "ssr", args: ["--project", "ssr:*"] },
        { name: "browser-vue", args: ["--project", "browser:vue"] },
        { name: "browser-angular", args: ["--project", "browser:angular"] },
      ],
    );
    // The other canaries run their projects together, and a canary of some targets theirs only,
    // among the targets the run selects.
    expect(canaryRuns(findCanary("L13-console-warn"), TARGET_NAMES, cases, shard)).toEqual([
      { name: "ssr+browser", args: ["--project", "ssr:*", "--project", "browser:*", ...filters] },
    ]);
    const qwikOnly = findCanary("L13-qwik-handler-throws");
    expect(canaryRuns(qwikOnly, TARGET_NAMES, cases, undefined)).toEqual([
      { name: "browser-qwik", args: ["--project", "browser:qwik"] },
    ]);
    expect(canaryRuns(qwikOnly, ["vue"], cases, undefined)).toEqual([]);
  });

  it("judge a canary's runs as one: each project's cells, every load failure, a failed status", () => {
    const failure = { project: "browser:vue", file: "cases/a/b/b.test.ts", errors: ["[uf guard]"] };
    const ssr = { status: 1, projects: { "ssr:vue": {} }, loadFailures: [] };
    const browser = { status: 0, projects: { "browser:vue": {} }, loadFailures: [failure] };
    expect(combineRuns([ssr, browser])).toEqual({
      status: 1,
      projects: { "ssr:vue": {}, "browser:vue": {} },
      loadFailures: [failure],
    });
    expect(combineRuns([{ ...ssr, status: 0 }, browser]).status).toBe(0);
    // A run that wrote no matrix, or no list of load failures, leaves the canary without either.
    const unfinished = { status: 1, projects: undefined, loadFailures: undefined };
    expect(combineRuns([ssr, unfinished])).toEqual({
      status: 1,
      projects: undefined,
      loadFailures: undefined,
    });
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

  // L9-unwired-handler's corruption needs a listener, and L10-stylesheet-rule-dropped's a sheet,
  // which the fixture has none of: each has a test of its own below.
  it.each(
    CANARIES.filter(
      (canary) =>
        canary.layer !== "L1" &&
        canary.id !== "L9-unwired-handler" &&
        canary.id !== "L10-stylesheet-rule-dropped",
    ),
  )("$id changes the output of every target it corrupts, without plugin errors", async (canary) => {
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
  });

  it("L2-output-edited leaves the IR alone, so only the golden comparison can catch it", async () => {
    const clean = await compileWith(null);
    const corrupted = await compileWith("L2-output-edited");
    expect(corrupted.ir).toEqual(clean.ir);
    expect(corrupted.outputs).not.toEqual(clean.outputs);
  });

  // A styled component's files end with its scoped sheet (ADR-0063), which has no template or
  // script to corrupt: a hook that threw on it would become a UF8001, and the compiler would
  // emit the module uncorrupted.
  it("corrupt a styled component's own files and leave its emitted sheet as it was", async () => {
    const dir = join(CASES_DIR, "styles", "scoped-basics");
    const text = readFileSync(join(dir, "Badge.uf.tsx"), "utf8");
    const compileStyled = (id: string | null, target: TargetName) =>
      compile(canarySource(id, text), {
        filename: "styles/scoped-basics/Badge.uf.tsx",
        targets: [target],
        resolve: caseResolver({ dir }, CASES_DIR),
        plugins: canaryPlugins(id, target),
        format: canaryFormats(id),
      });
    const hooked = CANARIES.filter(
      (canary) => canary.plugin && "output" in canary.plugin() && !canary.sheets,
    );
    expect(hooked.length).toBeGreaterThan(0);
    for (const canary of hooked) {
      for (const target of TARGET_NAMES.filter(
        (name) => corrupts(canary, name) && !(canary.followersOnly && name === REFERENCE),
      )) {
        const where = `${canary.id} on ${target}`;
        const clean = await compileStyled(null, target);
        const corrupted = await compileStyled(canary.id, target);
        expect(
          corrupted.diagnostics.map(({ code }) => code),
          where,
        ).not.toContain("UF8001");
        const sheet = (result: CompileResult) =>
          result.outputs[target]?.find(({ path }) => path === "Badge.uf.tsx.css");
        expect(sheet(corrupted), where).toEqual(sheet(clean));
        expect(sheet(clean), where).toBeDefined();
      }
    }
  });

  // ADR-0063: every target's sheet loads from the compile's output, so the hook corrupts each
  // copy, Angular's `styleUrl` included (the unplugin's `getSheet`).
  it("L10-stylesheet-rule-dropped drops a rule of each styled case's sheet, on the followers only", async () => {
    const styled = listCases().filter((info) => canaryCase(info).styled);
    // The scoping corpus, and the Styleframe cases with a sheet of their own (ADR-0064).
    for (const { id } of styled) expect(["styles", "styleframe"], id).toContain(id.split("/")[0]);
    expect(styled.length).toBeGreaterThanOrEqual(15);
    /** The cases a sheet of which the reference emitted. */
    const sheets = new Set<string>();
    for (const info of styled) {
      for (const { source, filename } of info.sources) {
        const text = readFileSync(source, "utf8");
        const compileStyled = (id: string | null, target: TargetName) =>
          compile(text, {
            filename,
            targets: [target],
            resolve: caseResolver(info, CASES_DIR),
            plugins: canaryPlugins(id, target),
          });
        for (const target of TARGET_NAMES) {
          const where = `${filename} on ${target}`;
          const clean = await compileStyled(null, target);
          const corrupted = await compileStyled("L10-stylesheet-rule-dropped", target);
          expect(corrupted.diagnostics, where).toEqual(clean.diagnostics);
          const part = (result: CompileResult, sheet: boolean) =>
            result.outputs[target]!.filter(({ path }) => path.endsWith(".css") === sheet);
          expect(part(corrupted, false), where).toEqual(part(clean, false));
          const [sheet, ...more] = part(clean, true);
          expect(more, where).toEqual([]);
          if (!sheet) continue;
          if (target === REFERENCE) sheets.add(info.id);
          const [dropped] = part(corrupted, true);
          if (target === REFERENCE) {
            expect(dropped, where).toEqual(sheet);
          } else {
            expect(dropped?.contents, where).toBe(dropFirstRule(sheet));
            expect(dropped?.contents, where).not.toBe(sheet.contents);
          }
        }
      }
    }
    expect(sheets.size).toBe(styled.length);
  });

  it("drops the first style rule outside @keyframes, inside an at-rule block too", () => {
    const drop = (contents: string) => dropFirstRule({ path: "A.uf.tsx.css", contents });
    expect(drop(".a { color: red; }\n\n.b { margin: 0; }\n")).toBe(".b { margin: 0; }\n");
    // Its comment stays, as a comment holding a brace or a string does.
    expect(drop('/* { */\n.a[title="}"] { content: "}"; }\n.b { margin: 0; }\n')).toBe(
      "/* { */\n.b { margin: 0; }\n",
    );
    expect(drop("@layer a, b;\n\n@layer b {\n  .a { color: red; }\n  .b { margin: 0; }\n}\n")).toBe(
      "@layer a, b;\n\n@layer b {\n  .b { margin: 0; }\n}\n",
    );
    expect(
      drop(
        "@keyframes spin {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}\n.a { color: red; }\n",
      ),
    ).toBe("@keyframes spin {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}\n");
    expect(() => drop("@keyframes spin {\n  to { opacity: 1; }\n}\n")).toThrow(
      /no style rule outside @keyframes/,
    );
  });

  it("needs the project's target for a canary that spares the reference", () => {
    expect(() => canaryPlugins("L10-root-hidden")).toThrow(/needs the project's target/);
    expect(canaryPlugins("L10-root-hidden", REFERENCE)).toEqual([]);
  });

  it("spares a case's own reference where a canary spares the reference (ADR-0057)", async () => {
    const compileAs = (references: Record<string, string>) =>
      compile(source, {
        filename,
        targets: ["react"],
        plugins: canaryPlugins("L10-root-hidden", "react", references),
        format: false,
      });
    const clean = await compile(source, { filename, targets: ["react"], format: false });
    const spared = await compileAs({ [filename.slice(0, filename.lastIndexOf("/"))]: "react" });
    expect(spared.outputs).toEqual(clean.outputs);
    const other = await compileAs({ "forms/elsewhere": "react" });
    expect(other.outputs).not.toEqual(clean.outputs);
  });

  it("L13 and L5-debugger put their statement in every target's render path", async () => {
    const result = await compileWith("L13-console-warn");
    const contents = (target: string) => result.outputs[target]![0]!.contents;
    expect(contents("react")).toMatch(
      /\.\.\.attributes\n\}: TaskListProps & TaskListAttributes\) \{\n {2}console\.warn\("\[uf canary\] L13 in react"\);/,
    );
    expect(contents("solid")).toMatch(
      /function TaskList\(\n {2}rawProps: TaskListProps & \{ class\?: string; style\?: JSX\.CSSProperties \},\n\) \{\n {2}console\.warn/,
    );
    expect(contents("qwik")).toMatch(
      /component\$<TaskListProps & \{ class\?: ClassList; style\?: CSSProperties \}>\(\n {2}\(\{\n[\s\S]*?\n {4}\.\.\.attributes\n {2}\}\) => \{\n {4}console\.warn/,
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

  it("L13-qwik-handler-throws gives Qwik's component a leaf with a throwing document listener, and changes no other target", async () => {
    const clean = await compileWith(null);
    const result = await compileWith("L13-qwik-handler-throws", "qwik");
    const contents = result.outputs.qwik![0]!.contents;
    const leaf = [
      "const UfCanaryLeafTaskList = component$(() => {",
      "  useOnDocument(",
      '    ["click", "pointerover", "keydown", "input", "focusin", "wheel"],',
      "    $(async () => {",
      "      await new Promise((resolve) => setTimeout(resolve));",
      '      throw new Error("[uf canary] L13 in qwik");',
      "    }),",
      "  );",
      "  return null;",
      "});",
      "",
    ].join("\n");
    // The import names what the leaf calls; the leaf follows the component, which renders it
    // after its root, in a fragment.
    expect(contents).toMatch(
      /^import \{ type CSSProperties, type ClassList, component\$, \$, useOnDocument \} from "@qwik\.dev\/core";$/m,
    );
    expect(contents.endsWith(`\n\n${leaf}`)).toBe(true);
    expect(contents).toMatch(
      /return \(\n {6}<>\n {8}<section\b[\s\S]*<\/section>\n {8}<UfCanaryLeafTaskList \/>\n {6}<\/>\n {4}\);/,
    );
    // Nothing else changed: the component's own code is as it was, a level deeper.
    expect(
      trimmedLines(
        contents
          .replace(`\n${leaf}`, "")
          .replace(", $, useOnDocument", "")
          .replace(/\n {6}<>\n/, "\n")
          .replace(/\n {8}<UfCanaryLeafTaskList \/>\n {6}<\/>\n/, "\n"),
      ),
    ).toEqual(trimmedLines(clean.outputs.qwik![0]!.contents));
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
    expect(root("react")).toMatch(/^<section\s+class="uf-canary"\s+className=/);
    expect(root("solid")).toMatch(/^<section\s+className="uf-canary"\s+class=/);
    // Qwik's root also takes the fallthrough `class` and `style` (ADR-0054): oxfmt breaks it.
    expect(root("qwik")).toMatch(/^<section\s+className="uf-canary"\s+class=/);
    expect(root("vue")).toMatch(/^<section v-html="'uf-canary'" class=/);
    // Svelte's and Astro's roots also spread their styled parents' scope attributes (ADR-0063):
    // the tag breaks.
    expect(root("svelte")).toMatch(/^<section style:uf-canary="1"\s+class=/);
    expect(root("angular")).toMatch(/^<section \*ngIf="true"\s+class=/);
    expect(root("astro")).toMatch(/^<section set:html="uf-canary"\s+class:list=/);
  });

  it("L4-consumer types each target's props `any` where its consumers' checker reads them", async () => {
    const result = await compileWith("L4-consumer");
    // The exported types are widened too, as the test of `types/exported-types` proves.
    const lines = (target: string) =>
      result.outputs[target]![0]!.contents.split("\n").filter(widenedProps);
    expect(lines("react")).toEqual(["}: any) {"]);
    expect(result.outputs.react![0]!.contents).toMatch(
      /^export default function TaskList\(\{\n[\s\S]*?\n\}: any\) \{$/m,
    );
    expect(lines("solid")).toEqual(["export default function TaskList(rawProps: any) {"]);
    expect(lines("qwik")).toEqual(["export default component$<any>("]);
    expect(lines("vue")).toEqual([
      'const { title = "Tasks (today)", tasks, done, tone = "info" } = defineProps<Record<string, any>>();',
    ]);
    // The pattern runs over several lines, beside the fallthrough props (ADR-0054).
    expect(lines("svelte")).toEqual(["  }: any = $props();"]);
    expect(lines("astro")).toEqual(["type Props = any;"]);
    // The scope directive's input too, which no consumer binds (ADR-0063).
    expect(lines("angular")).toEqual([
      "  readonly ufScope = input.required<any>();",
      '  readonly title = input<any>("Tasks (today)", {',
      "  readonly tasks = input.required<any>();",
      "  readonly done = input.required<any>();",
      '  readonly tone = input<any>("info", {',
      "  readonly class = input<any>();",
      "  readonly style = input<any>();",
    ]);
  });

  it("L4-consumer types each target's events `any` too, on a case whose consumers misuse one", async () => {
    // The canary's evidence needs one unmet directive per cell, which the prop fixtures give
    // alone: only this test proves the events are widened.
    const info = listCases().find(({ id }) => id === "events/emit-payloads")!;
    const lines = async (target: TargetName) => {
      const { outputs } = await compile(readFileSync(info.source, "utf8"), {
        filename: info.filename,
        targets: [target],
        plugins: canaryPlugins("L4-consumer", target),
      });
      return outputs[target]![0]!.contents.split("\n").filter(widenedProps);
    };
    expect(await lines("react")).toEqual(["}: any) {"]);
    const { outputs: react } = await compile(readFileSync(info.source, "utf8"), {
      filename: info.filename,
      targets: ["react"],
      plugins: canaryPlugins("L4-consumer", "react"),
    });
    expect(react.react![0]!.contents).toMatch(
      /^export default function FileRow\(\{\n[\s\S]*?\n\}: any\) \{$/m,
    );
    expect(await lines("solid")).toEqual(["export default function FileRow(props: any) {"]);
    expect(await lines("qwik")).toEqual(["export default component$<any>("]);
    expect(await lines("vue")).toEqual([
      "const { path, size } = defineProps<Record<string, any>>();",
      "const emit = defineEmits<Record<string, any[]>>();",
    ]);
    expect(await lines("svelte")).toEqual(["  }: any = $props();"]);
    expect(await lines("astro")).toEqual(["type Props = any;"]);
    expect(await lines("angular")).toEqual([
      "  readonly ufScope = input.required<any>();",
      "  readonly path = input.required<any>();",
      "  readonly size = input.required<any>();",
      "  readonly class = input<any>();",
      "  readonly style = input<any>();",
      "  readonly refresh = output<any>();",
      "  readonly open = output<any>();",
      "  readonly move = output<any>();",
      "  readonly pick = output<any>();",
      "  readonly share = output<any>();",
    ]);
  });

  it("L4-consumer types a Vue model `any` too, on a case whose consumers misuse one", async () => {
    // As for the events: the prop fixtures meet the evidence alone, so only this test proves
    // the models are widened.
    const info = listCases().find(({ id }) => id === "models/component")!;
    const stepper = info.sources.find(({ filename }) => filename.endsWith("/Stepper.uf.tsx"))!;
    const { outputs } = await compile(readFileSync(stepper.source, "utf8"), {
      filename: stepper.filename,
      targets: ["vue"],
      plugins: canaryPlugins("L4-consumer", "vue"),
    });
    expect(outputs.vue![0]!.contents.split("\n").filter((line) => /\bany\b/.test(line))).toEqual([
      "const { label } = defineProps<Record<string, any>>();",
      'const value = defineModel<any>("value", { default: 0 });',
    ]);
  });

  it("L4-consumer types a module's exported types `any`, on a case whose consumers misuse one", async () => {
    // The type directives of `types/exported-types` (ADR-0068): the props type and a type no
    // component reaches, each declared `any` where the source declares it.
    const info = listCases().find(({ id }) => id === "types/exported-types")!;
    const { outputs } = await compile(readFileSync(info.source, "utf8"), {
      filename: info.filename,
      targets: ["vue"],
      plugins: canaryPlugins("L4-consumer", "vue"),
    });
    expect(outputs.vue![0]!.contents.split("\n").filter((line) => /\bany\b/.test(line))).toEqual([
      "export type ButtonTone = any;",
      "export type ButtonSize = any;",
      "export type ButtonProps = any;",
      'const { label, tone = "primary" } = defineProps<Record<string, any>>();',
    ]);
  });

  it("widens an exported interface, a type alias and a type re-export, keeping type parameters", () => {
    const widened = anyExportedTypes(
      [
        'import type { Item, Tone } from "./types";',
        'export type { Tone, Size as ButtonSize } from "./types";',
        "export interface ListProps<T extends { id: string } = Item> extends Base<T> {",
        "  items: T[];",
        "  pick?: (item: T) => void;",
        "}",
        'export type Picked = Pick<Item, "id" | "label"> &',
        "  Readonly<{ select: () => void }>;",
        "type Local = string;",
      ].join("\n"),
    );
    expect(widened.split("\n")).toEqual([
      'import type { Item } from "./types";',
      "export type Tone = any;",
      "export type ButtonSize = any;",
      "export type ListProps<T extends { id: string } = Item> = any;",
      "export type Picked = any;",
      "type Local = string;",
    ]);
  });

  it("L4-consumer applies to the cases with consumer fixtures, on each target that has them", () => {
    const canary = findCanary("L4-consumer");
    const [withFixtures, without] = ["events/emit-payloads", "basics/hello"].map((id) =>
      canaryCase(listCases().find((info) => info.id === id)!),
    );
    for (const target of TARGET_NAMES) {
      expect(canary.appliesTo!(withFixtures!, target), target).toBe(true);
      expect(canary.appliesTo!(without!, target), target).toBe(false);
    }
  });

  it("L4-consumer's evidence is an unmet directive, declared in a .uf.tsx or a .ts module", () => {
    const evidence = findCanary("L4-consumer").evidence.toolchain!["consumer check"] as RegExp;
    const unmet = (at: string) =>
      `tests/toolchains/react/consumers/types/shared-type/MisuseType.tsx:4: expected TS2322 for Badge.type:Tone (${at}), got none`;
    expect(unmet("Badge.uf.tsx:3")).toMatch(evidence);
    // A type re-exported from the case's shared module is declared there (ADR-0068).
    expect(unmet("types.ts:2")).toMatch(evidence);
    expect(unmet("types.d.mts:2")).not.toMatch(evidence);
    expect(
      "tests/toolchains/react/consumers/types/shared-type/MisuseType.tsx:4: unexpected TS2322 Type 'number' is not assignable.",
    ).not.toMatch(evidence);
  });

  it("L10-root-inverted styles the root element in each target's own syntax", async () => {
    for (const target of TARGET_NAMES.filter((name) => name !== REFERENCE)) {
      const { outputs } = await compileWith("L10-root-inverted", target);
      const contents = outputs[target]![0]!.contents;
      expect(contents.match(/invert\(0\.8\)/g), target).toHaveLength(1);
      // Angular binds the root's style, so that it can merge the consumer's (ADR-0056). React's,
      // Qwik's and Astro's roots also take a consumer's style, after their own (ADR-0054).
      const spread =
        target === "react" || target === "qwik"
          ? ", \\.\\.\\.style"
          : target === "astro"
            ? "(?:, \\.\\.\\.\\w+)?"
            : "";
      expect(contents, target).toMatch(
        target === "angular"
          ? /<section\b[^>]*\[style\]="\{ filter: 'invert\(0\.8\)'/
          : new RegExp(
              `<section\\b[^>]*\\bstyle=(?:"filter: invert\\(0\\.8\\)"|\\{\\{ filter: "invert\\(0\\.8\\)"${spread} \\}\\}|\\{mergeStyle\\(\\{ filter: "invert\\(0\\.8\\)" \\}, style\\)\\}|\\{\\{ \\.\\.\\.\\{ filter: "invert\\(0\\.8\\)" \\}, \\.\\.\\.props\\.style \\}\\})`,
            ),
      );
    }
  });

  // A component's root inside another's is inverted twice: the filter must not undo itself,
  // or a child that holds all the parent's ink renders the reference's pixels.
  it("L10-root-inverted changes a pixel that a nested root inverts twice", async () => {
    const root = await corruptedRoot(
      "L10-root-inverted",
      "export default function Tag() {\n  return <span>a</span>;\n}\n",
    );
    const [filter] = declarationsOf(root);
    const amount = Number(/^filter: invert\(([\d.]+)\)$/.exec(filter!)![1]);
    // The filter's per-channel function (Filter Effects 1, `invert()`).
    const invert = (channel: number) => amount * (1 - channel) + (1 - amount) * channel;
    for (const channel of [0, 1]) expect(invert(invert(channel))).not.toBeCloseTo(channel, 2);
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
      expect(declarationsOf(inverted)).toEqual(["display: inline-block", "filter: invert(0.8)"]);
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
    // A component at the root (React's context provider) is passed over for the first DOM element;
    // without one, the first element takes it.
    expect(
      addRootAttribute(
        {
          path: "Level.tsx",
          contents:
            "export default function Level() {\n  return (\n    <DepthKey value={depthValue}>\n      <section>\n        <Level />\n      </section>\n    </DepthKey>\n  );\n}\n",
        },
        "data-x={1}",
      ),
    ).toContain("<DepthKey value={depthValue}>\n      <section data-x={1}>");
    expect(
      addRootAttribute(
        {
          path: "Primary.tsx",
          contents: 'export default function Primary() {\n  return <Base text="Save" />;\n}\n',
        },
        "data-x={1}",
      ),
    ).toContain('<Base data-x={1} text="Save" />');
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
    // A generic component's type parameters, whose constraint holds braces (ADR-0068).
    const generic = injectScript(
      {
        path: "A.tsx",
        contents:
          "export default function A<T extends { id: string } = { id: string }>({ rows }: { rows: T[] }) {\n  return <p>{rows.length}</p>;\n}\n",
      },
      "react",
      "x();",
      "render",
    );
    expect(generic).toContain("{ rows: T[] }) {\n  x();\n  return <p>");
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
    // The component's class, not a directive's declared before it (ADR-0047, ADR-0063).
    const directive =
      '@Directive({ selector: "[ufScope]" })\nexport class Scope {\n  constructor() {\n    y();\n  }\n}\n\n';
    expect(
      injectScript(
        { path: "a.ts", contents: `${directive}@Component({})\nexport default class A {}\n` },
        "angular",
        "x();",
        "render",
      ),
    ).toBe(
      `${directive}@Component({})\nexport default class A {\n  constructor() {\n    x();\n  }\n}\n`,
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
    // A generic component's type parameters, a constraint's arrow among them (ADR-0068).
    expect(
      mismatchClosingTag({
        path: "List.tsx",
        contents:
          "export default function List<T extends { on: () => void }>(props: { items: T[] }) {\n  return <ul>{props.items.length}</ul>;\n}\n",
      }),
    ).toBe(
      "export default function List<T extends { on: () => void }>(props: { items: T[] }) {\n  return <ul>{props.items.length}</span>;\n}\n",
    );
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

/** A line the L4-consumer canary widened that is not an exported type's declaration. */
function widenedProps(line: string): boolean {
  return /\bany\b/.test(line) && !/^\s*export type [\w$]+(?:<.*>)? = any;$/.test(line);
}
