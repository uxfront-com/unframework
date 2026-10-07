import { readFileSync } from "node:fs";

import { exportName, parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { AUTHORING_APIS, AUTHORING_TYPES, LATER_APIS } from "../src/authoring.ts";
import { codes, component, problems, run } from "./helpers.ts";

/** What `packages/unframework/src/index.ts` exports: its functions, and its types. */
function packageExports(): { values: Set<string>; types: Set<string> } {
  const file = "packages/unframework/src/index.ts";
  const source = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
  const values = new Set<string>();
  const types = new Set<string>();
  for (const statement of parseModule(file, source).program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    const { declaration } = statement;
    if (declaration?.type === "FunctionDeclaration" || declaration?.type === "TSDeclareFunction") {
      values.add(declaration.id!.name);
    } else if (
      declaration?.type === "TSInterfaceDeclaration" ||
      declaration?.type === "TSTypeAliasDeclaration"
    ) {
      types.add(declaration.id.name);
    } else if (!declaration) {
      for (const specifier of statement.specifiers) types.add(exportName(specifier.exported));
    }
  }
  return { values, types };
}

describe("the authoring API", () => {
  // ADR-0006: the compiler recognises the API by binding, from the package's own exports.
  it("is what the package exports: M2's APIs, M3's, and its types", () => {
    const { values, types } = packageExports();
    expect([...AUTHORING_APIS, ...LATER_APIS.keys()].toSorted()).toEqual([...values].toSorted());
    expect([...AUTHORING_TYPES].toSorted()).toEqual([...types].toSorted());
  });

  it("accepts named imports of the API and its types, aliases and type-only imports included", () => {
    const source = [
      'import { computed as derive, ref, type Ref } from "unframework";',
      'import type { ComputedRef, Anything } from "unframework";',
      'import type { JSX } from "unframework/jsx-runtime";',
      "export function A() { const count = ref(1); const double = derive(() => count.value * 2); return <p>{double.value}</p>; }",
    ].join("\n");
    expect(run(source).diagnostics).toEqual([]);
  });

  it("reports what is not the API (UF2016), and M3's APIs as landing in M3 (UF1002)", () => {
    const source = [
      'import * as uf from "unframework";',
      'import api from "unframework";',
      'import "unframework";',
      'import { reactive, toRefs, defineModel, provide, nope } from "unframework";',
      'import { ref } from "unframework/jsx-runtime";',
      "export function A() { return <p />; }",
    ].join("\n");
    const { diagnostics, module } = run(source);
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual([
      "UF2016 * as uf",
      "UF2016 api",
      'UF2016 import "unframework";',
      "UF2016 reactive",
      "UF2016 toRefs",
      "UF1002 defineModel",
      "UF1002 provide",
      "UF2016 nope",
      "UF2016 ref",
    ]);
    expect(diagnostics[3]!.message).toBe(
      "`reactive` is Vue's, not unframework's: state is a `ref`, whose value is replaced whole (ADR-0008).",
    );
    expect(diagnostics[5]!.message).toBe(
      "`defineModel` is not supported yet: two-way bindings (`defineModel` and `v-model`) land in M3.",
    );
    expect(diagnostics[7]!.message).toBe('"unframework" exports no `nope`.');
  });

  it("recognises the API by binding, not by name: a local `ref` is no API", () => {
    const { source, diagnostics, module } = component("<p>{count.value}</p>", {
      before: 'import { ref as state } from "unframework";\n',
      setup: "const count = state(0); ",
    });
    expect(problems(source, diagnostics)).toEqual([]);
    expect(module!.components[0]!.setup.map((item) => item.kind)).toEqual(["State"]);
    // Not imported, `ref` is a call the setup would run: a statement it cannot keep.
    const local = component("<p>{count}</p>", {
      before: "function ref(value: number) { return value; }\n",
      setup: "const count = ref(0); ",
    });
    expect(codes(local.diagnostics)).toEqual(["UF1002", "UF3020"]);
  });
});
