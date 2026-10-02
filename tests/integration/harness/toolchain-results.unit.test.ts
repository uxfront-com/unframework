// What L3 and L4 report from a toolchain's results, with results of their own: a message on a
// path that is no output (the toolchain's tsconfig, an imported file) fails every case.
import { join } from "node:path";

import type { FrameworkCompileResult, ToolchainMessage } from "@unframework/codegen";
import { describe, expect, it } from "vitest";

import { ROOT } from "./paths.ts";
import { frameworkCompileProblems, typecheckProblems } from "./toolchain-results.ts";

const hello = join(ROOT, "cases/basics/hello/__output__/react/Hello.tsx");
const card = join(ROOT, "cases/basics/card/__output__/react/Card.tsx");
const tsconfig = join(ROOT, "../toolchains/react/.uf-tmp/typecheck-1/tsconfig.json");
const helper = join(ROOT, "../toolchains/react/helper.ts");
const outputs = new Set([hello, card]);
const clean: FrameworkCompileResult = { errors: [], warnings: [] };

describe("typecheckProblems", () => {
  it("reports each diagnostic on the case's own files, and nothing for clean files", () => {
    const results = new Map<string, ToolchainMessage[]>([
      [
        hello,
        [{ code: "TS2322", message: "Type 'string' is not assignable.", line: 2, column: 3 }],
      ],
      [card, []],
    ]);
    expect(typecheckProblems(results, [hello], outputs)).toEqual([
      "cases/basics/hello/__output__/react/Hello.tsx: TS2322 Type 'string' is not assignable. (line 2, column 3)",
    ]);
    expect(typecheckProblems(results, [card], outputs)).toEqual([]);
  });

  it("fails every case on a problem outside the outputs: a broken tsconfig, an imported file", () => {
    const results = new Map<string, ToolchainMessage[]>([
      [hello, []],
      [card, []],
      [tsconfig, [{ code: "TS5023", message: "Unknown compiler option 'notARealOption'." }]],
      [helper, [{ code: "TS2322", message: "Type 'string' is not assignable.", line: 1 }]],
    ]);
    const expected = [
      "The checker reported problems outside the outputs:",
      "../toolchains/react/.uf-tmp/typecheck-1/tsconfig.json: TS5023 Unknown compiler option 'notARealOption'.",
      "../toolchains/react/helper.ts: TS2322 Type 'string' is not assignable. (line 1)",
    ];
    expect(typecheckProblems(results, [hello], outputs)).toEqual(expected);
    expect(typecheckProblems(results, [card], outputs)).toEqual(expected);
    // A path the checker mentions without a message is no problem.
    expect(
      typecheckProblems(
        new Map([
          [hello, []],
          [helper, []],
        ]),
        [hello],
        outputs,
      ),
    ).toEqual([]);
  });

  it("fails a file the checker reported nothing for: it may never have been checked", () => {
    expect(typecheckProblems(new Map(), [hello], outputs)).toEqual([
      "cases/basics/hello/__output__/react/Hello.tsx: the checker reported nothing for this file.",
    ]);
  });
});

describe("frameworkCompileProblems", () => {
  it("reports errors and warnings on the case's own files", () => {
    const results = new Map([
      [
        hello,
        {
          errors: [{ message: "Unexpected closing tag.", line: 1 }],
          warnings: [{ code: "a11y", message: "Missing alt." }],
        },
      ],
      [card, clean],
    ]);
    expect(frameworkCompileProblems(results, [hello], outputs)).toEqual([
      "cases/basics/hello/__output__/react/Hello.tsx: error Unexpected closing tag. (line 1)",
      "cases/basics/hello/__output__/react/Hello.tsx: warning a11y Missing alt.",
    ]);
    expect(frameworkCompileProblems(results, [card], outputs)).toEqual([]);
    expect(frameworkCompileProblems(new Map(), [card], outputs)).toEqual([
      "cases/basics/card/__output__/react/Card.tsx: the framework compiler reported nothing for this file.",
    ]);
  });

  it("fails every case on a problem outside the outputs", () => {
    const results = new Map([
      [hello, clean],
      [helper, { errors: [], warnings: [{ message: "Deprecated option." }] }],
    ]);
    expect(frameworkCompileProblems(results, [hello], outputs)).toEqual([
      "The framework compiler reported problems outside the outputs:",
      "../toolchains/react/helper.ts: warning Deprecated option.",
    ]);
  });
});
