// The compile project's own checks on the real compiler, with inputs the corpus cannot hold:
// fixes that leave their diagnostic or bring another, and outputs that differ between compiles
// or are not formatted. On the corpus, the fix check applies the fixes of the diagnostics cases
// (and jsx/escaping's), and the L1-fix-no-op canary proves it catches a fix that fixes nothing.
import { compile, TARGET_NAMES } from "@unframework/compiler";
import type { CompileResult, CompilerPlugin } from "@unframework/compiler";
import type { Diagnostic } from "@unframework/diagnostics";
import { describe, expect, it } from "vitest";

import { checkFixes, formattingProblems, nondeterminism } from "./compile-checks.ts";

const filename = "fixture/badge/Badge.uf.tsx";
/** `className` is UF3004, with a safe fix that renames it to `class`. */
const fixable = 'export default function Badge() {\n  return <p className="badge">New</p>;\n}\n';

function compileWith(source: string, plugins: CompilerPlugin[] = []): Promise<CompileResult> {
  return compile(source, { filename, targets: TARGET_NAMES, plugins });
}

const recompile = async (source: string) => (await compileWith(source)).diagnostics;

describe("checkFixes (L1)", () => {
  it("passes when every fix applies and the source recompiles clean", async () => {
    const { diagnostics } = await compileWith(fixable);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["UF3004"]);
    expect(diagnostics[0]!.fixes).toHaveLength(1);
    for (const target of TARGET_NAMES) {
      await expect(checkFixes(fixable, diagnostics, target, recompile)).resolves.toBeUndefined();
    }
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
