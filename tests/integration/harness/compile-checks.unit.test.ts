// The compile project's own checks on the real compiler, with inputs the corpus cannot hold:
// fixes that leave their diagnostic or bring another, and outputs that differ between compiles
// or are not formatted. On the corpus, the fix check applies the fixes of the diagnostics cases
// (and jsx/escaping's), and the L1-fix-no-op canary proves it catches a fix that fixes nothing.
import { builtinTargets, compile, TARGET_NAMES } from "@unframework/compiler";
import type { CompileResult, CompilerPlugin } from "@unframework/compiler";
import { applyFixes } from "@unframework/diagnostics";
import type { Diagnostic } from "@unframework/diagnostics";
import { describe, expect, it } from "vitest";

import {
  checkFixes,
  expectationProblems,
  formattingProblems,
  nondeterminism,
  referenceProblems,
} from "./compile-checks.ts";

const filename = "fixture/badge/Badge.uf.tsx";
/** `className` is UF3004, with a safe fix that renames it to `class`. */
const fixable = 'export default function Badge() {\n  return <p className="badge">New</p>;\n}\n';

function compileWith(source: string, plugins: CompilerPlugin[] = []): Promise<CompileResult> {
  return compile(source, { filename, targets: TARGET_NAMES, plugins });
}

const recompile = async (source: string) => (await compileWith(source)).diagnostics;

/** Compiles for Astro alone: the one target whose capability cells report notes (`info`). */
const astro = async (source: string) =>
  (await compile(source, { filename, targets: ["astro"] })).diagnostics;

describe("checkFixes (L1)", () => {
  it("passes when every fix applies and the source recompiles clean", async () => {
    const { diagnostics } = await compileWith(fixable);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UF3004"]);
    expect(diagnostics[0]!.fixes).toHaveLength(1);
    for (const target of TARGET_NAMES) {
      await expect(checkFixes(fixable, diagnostics, target, recompile)).resolves.toBeUndefined();
    }
  });

  it("passes a fix that lets the compiler report a target's notes, which are no problems", async () => {
    // `onKeyDown` is UF3004 (rename to `onKeydown`): the module lowers only once it is fixed, and
    // then Astro notes its inert listener (UF4001, info), which the first compile could not.
    const listener =
      'export default function Field() {\n  return <input aria-label="Name" onKeyDown={() => {}} />;\n}\n';
    const diagnostics = await astro(listener);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UF3004"]);
    const after = await astro(applyFixes(listener, diagnostics[0]!.fixes!));
    expect(after.map(({ code, severity, target }) => [code, severity, target])).toEqual([
      ["UF4001", "info", "astro"],
    ]);
    await expect(checkFixes(listener, diagnostics, "astro", astro)).resolves.toBeUndefined();
  });

  it("passes a fix that brings a capability cell's warning, whatever its severity", async () => {
    // UF2007's likely fix turns the setup's snapshot of an optional prop into a derived value
    // that reads it, which Qwik declares a late prop may not reach (`late-prop`, a warning).
    const snapshot = [
      "export interface SeedsProps {",
      "  start: number;",
      "  label?: string;",
      "}",
      "",
      'export default function Seeds({ start, label = "Seeds" }: SeedsProps) {',
      "  const prefix = `${label}:`;",
      "  return (",
      "    <p>",
      "      {prefix} {start}",
      "    </p>",
      "  );",
      "}",
      "",
    ].join("\n");
    const { diagnostics } = await compileWith(snapshot);
    expect(diagnostics.map(({ code, fixes }) => [code, fixes?.length])).toEqual([["UF2007", 1]]);
    const after = await recompile(applyFixes(snapshot, diagnostics[0]!.fixes!));
    expect(after.map(({ code, severity, target }) => [code, severity, target])).toEqual([
      ["UF4001", "warning", "qwik"],
    ]);
    for (const target of TARGET_NAMES) {
      await expect(checkFixes(snapshot, diagnostics, target, recompile)).resolves.toBeUndefined();
    }
    // Only the target's own cell, in its own words: a matrix that does not declare the
    // capability unsupported leaves the warning a new diagnostic the fix brought.
    const { qwik } = builtinTargets;
    const supported = {
      ...qwik.capabilities,
      "late-prop": { support: "native" as const },
    };
    await expect(checkFixes(snapshot, diagnostics, "qwik", recompile, supported)).rejects.toThrow(
      /does not recompile clean:\n[\s\S]*\+ UF4001 The qwik target does not support late-prop: /,
    );
  });

  it("fails a fix that does not remove its diagnostic", async () => {
    const { diagnostics } = await compileWith(fixable);
    // The fix rewrites the attribute's name as it was: the source does not change.
    const broken: Diagnostic[] = diagnostics.map((diagnostic) => ({
      ...diagnostic,
      fixes: diagnostic.fixes?.map((fix) => ({
        ...fix,
        edits: fix.edits.map((edit) => ({ ...edit, text: "className" })),
      })),
    }));
    await expect(checkFixes(fixable, broken, "react", recompile)).rejects.toThrow(
      /Applying the fixes of UF3004 does not recompile clean:\n[\s\S]*\+ UF3004 /,
    );
  });

  it("fails a fix that brings another diagnostic", async () => {
    const { diagnostics } = await compileWith(fixable);
    // `<p id="uf-id-1" class="badge">`: the reserved id prefix is UF3005.
    const broken: Diagnostic[] = diagnostics.map((diagnostic) => ({
      ...diagnostic,
      fixes: diagnostic.fixes?.map((fix) => ({
        ...fix,
        edits: fix.edits.map((edit) => ({ ...edit, text: 'id="uf-id-1" class' })),
      })),
    }));
    await expect(checkFixes(fixable, broken, "vue", recompile)).rejects.toThrow(
      /does not recompile clean:\n[\s\S]*\+ UF3005 /,
    );
  });
});

describe("nondeterminism (L2)", () => {
  it("passes two compiles of one source", async () => {
    const [first, second] = await Promise.all([compileWith(fixable), compileWith(fixable)]);
    for (const target of TARGET_NAMES)
      expect(nondeterminism(first, second, target)).toBe(undefined);
  });

  it("names the difference between two compiles that differ", async () => {
    let compiles = 0;
    const counter = (): CompilerPlugin => {
      compiles += 1;
      const run = compiles;
      return {
        name: "counter",
        output: (files) =>
          files.map((file) => ({ ...file, contents: `${file.contents}// ${run}\n` })),
      };
    };
    const source = 'export default function Badge() {\n  return <p class="badge">New</p>;\n}\n';
    const first = await compileWith(source, [counter()]);
    const second = await compileWith(source, [counter()]);
    expect(nondeterminism(first, second, "svelte")).toMatch(
      /^Compiling twice gave different results:\n[\s\S]*\+ .*\/\/ 2/,
    );
  });
});

describe("formattingProblems (L2)", () => {
  it("passes the compiler's formatted output on every target", async () => {
    const source = 'export default function Badge() {\n  return <p class="badge">New</p>;\n}\n';
    const { outputs } = await compileWith(source);
    for (const target of TARGET_NAMES) {
      expect(await formattingProblems(target, outputs[target]!), target).toEqual([]);
    }
  });

  it("fails output that formatting would change, code and markup alike", async () => {
    expect(
      await formattingProblems("react", [
        { path: "Badge.tsx", contents: "export const  badge  =  1\n" },
      ]),
    ).toEqual([expect.stringMatching(/^react\/Badge\.tsx is not formatted idempotently:\n/)]);
    expect(
      await formattingProblems("vue", [
        { path: "Badge.vue", contents: "<template>\n</template>\n\n" },
      ]),
    ).toEqual([expect.stringMatching(/^vue\/Badge\.vue is not formatted idempotently:\n/)]);
  });

  it("fails output that no longer parses", async () => {
    expect(
      await formattingProblems("solid", [
        { path: "Badge.tsx", contents: "export const badge = <p>a</span>;\n" },
      ]),
    ).toEqual([expect.stringMatching(/^solid\/Badge\.tsx does not parse when formatted again: /)]);
  });
});

describe("expectationProblems (L1)", () => {
  const internal = {
    code: "UF9001",
    severity: "error",
    message: "The angular target failed on Probe: Cannot parse `await` as statements",
    target: "angular",
  };

  it("fails an internal error on its own target, in any case", () => {
    for (const hasSpec of [true, false]) {
      expect(expectationProblems([internal], "angular", hasSpec)).toEqual([
        expect.stringMatching(
          /^The case expects the internal error UF9001 \(The angular target failed/,
        ),
      ]);
      expect(expectationProblems([internal], "react", hasSpec)).toEqual([]);
    }
    // One without a target is every target's.
    const { target: _target, ...everywhere } = internal;
    expect(expectationProblems([everywhere], "react", false)).toHaveLength(1);
  });

  it("passes a feature case's error that its target declares for a capability it lacks", async () => {
    // Vue declares `listbox` unsupported, with an error (ADR-0033).
    const source =
      'export default function Pick() {\n  return (\n    <select aria-label="Size" size="2">\n      <option>S</option>\n      <option>M</option>\n    </select>\n  );\n}\n';
    const { diagnostics } = await compileWith(source);
    const vue = diagnostics.filter((diagnostic) => diagnostic.target === "vue");
    expect(vue.map(({ code, severity }) => [code, severity])).toEqual([["UF4001", "error"]]);
    for (const target of TARGET_NAMES) {
      expect(expectationProblems(diagnostics, target, true), target).toEqual([]);
    }
  });

  it("fails any other error in a case with a spec, and lets a diagnostics case expect it", () => {
    const undeclared = {
      code: "UF4001",
      severity: "error",
      message:
        "The react target does not declare whether it supports listbox, so the compiler treats it as unsupported.",
      target: "react",
    };
    const analyser = { code: "UF2004", severity: "error", message: "A state is changed in place." };
    expect(expectationProblems([undeclared, analyser], "react", true)).toEqual([
      expect.stringMatching(
        /^The case has a spec, yet expects the error UF4001 for react \(The react target does not declare/,
      ),
      expect.stringMatching(/^The case has a spec, yet expects the error UF2004 for react/),
    ]);
    expect(expectationProblems([undeclared, analyser], "react", false)).toEqual([]);
    // A warning or a note is no error: Astro's inert listeners are notes.
    expect(expectationProblems([{ ...analyser, severity: "warning" }], "react", true)).toEqual([]);
  });
});

describe("referenceProblems (L1, ADR-0057)", () => {
  const LISTBOX =
    'export default function Pick() {\n  return (\n    <select aria-label="Size" size="2">\n      <option>S</option>\n      <option>M</option>\n    </select>\n  );\n}\n';
  const PLAIN = "export default function Hello() {\n  return <p>Hello</p>;\n}\n";

  it("lets a case Vue has no output for name a target whose cell is native", async () => {
    const { diagnostics } = await compileWith(LISTBOX);
    expect(referenceProblems(diagnostics, true, "vue", "react")).toEqual([]);
  });

  it("asks a case Vue has no output for to name one", async () => {
    const { diagnostics } = await compileWith(LISTBOX);
    expect(referenceProblems(diagnostics, true, "vue", undefined)).toEqual([
      expect.stringMatching(
        /^vue, the run's reference, has no output for the case: it leaves listbox unsupported/,
      ),
    ]);
  });

  it("refuses a reference the run's reference does not need, and one on a case without a spec", async () => {
    const plain = await compileWith(PLAIN);
    expect(referenceProblems(plain.diagnostics, true, "vue", "react")).toEqual([
      expect.stringMatching(/^The case names react as its reference, yet vue renders it/),
    ]);
    expect(referenceProblems(plain.diagnostics, false, "vue", "react")).toEqual([
      expect.stringMatching(/^The case names a reference, and has no spec/),
    ]);
    const listbox = await compileWith(LISTBOX);
    expect(referenceProblems(listbox.diagnostics, true, "react", "vue")).toEqual([
      expect.stringMatching(/^The case names vue as its reference, yet react renders it/),
    ]);
  });
});
