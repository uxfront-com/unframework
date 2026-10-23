// Imports that pass through (ADR-0064): the `passThrough` option, checked before anything is
// compiled and handed to the analyser, and a plugin's `ir` hook, which may drop a pass-through
// import, never add, duplicate, reorder or change one.
import type { PassThroughImport, UfModule } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { checkPassThrough, compile } from "../src/index.ts";

const source = [
  'import { button } from "virtual:a";',
  'import "virtual:b.css";',
  'import "virtual:c.css";',
  "export default function B() {",
  "  return <p class={button()}>Hi</p>;",
  "}",
  "",
].join("\n");

describe("the passThrough option", () => {
  it.each(["", ".", "./x", "../x", "/x", "\\x", "C:x", "c:\\x"])(
    "rejects the prefix %j loudly",
    async (prefix) => {
      expect(() => checkPassThrough([prefix])).toThrow(
        `The passThrough prefix "${prefix.replaceAll("\\", "\\\\")}" is invalid`,
      );
      await expect(
        compile(source, { filename: "B.uf.tsx", targets: ["vue"], passThrough: [prefix] }),
      ).rejects.toThrow("is invalid");
    },
  );

  it("passes `virtual:` imports by default, and the analyser reads a list that replaces it", async () => {
    const byDefault = await compile(source, { filename: "B.uf.tsx", targets: ["vue"] });
    expect(byDefault.diagnostics).toEqual([]);
    const styled =
      'import { css } from "styled-system/css";\nexport default function B() {\n  return <p class={css()}>Hi</p>;\n}\n';
    const options = {
      filename: "B.uf.tsx",
      targets: ["vue"] as const,
      passThrough: ["styled-system/"],
    };
    const replaced = await compile(styled, options);
    expect(replaced.diagnostics).toEqual([]);
    expect(replaced.ir?.passThroughImports?.map(({ specifier }) => specifier)).toEqual([
      "styled-system/css",
    ]);
    // `virtual:` no longer passes through: the imports keep today's code.
    const virtual = await compile(source, options);
    expect(new Set(virtual.diagnostics.map(({ code }) => code))).toEqual(new Set(["UF1002"]));
    expect(virtual.ir).toBeUndefined();
  });

  it("keeps the imports in source order, after the sorted ones", async () => {
    const { outputs } = await compile(source, { filename: "B.uf.tsx", targets: ["react"] });
    const code = outputs.react![0]!.contents;
    const order = ['from "react"', '"virtual:a"', '"virtual:b.css"', '"virtual:c.css"'].map(
      (text) => code.indexOf(text),
    );
    expect(order).toEqual(order.toSorted((a, b) => a - b));
    expect(order.every((index) => index >= 0)).toBe(true);
  });
});

describe("a plugin's pass-through imports", () => {
  /** Compiles `source` with an `ir` hook that rewrites the pass-through imports. */
  async function withHook(change: (imports: PassThroughImport[]) => PassThroughImport[]) {
    const ir = (module: UfModule): UfModule => ({
      ...module,
      passThroughImports: change(structuredClone([...module.passThroughImports!])),
    });
    return compile(source, {
      filename: "B.uf.tsx",
      targets: ["vue"],
      plugins: [{ name: "p", ir }],
    });
  }

  it("may drop one", async () => {
    const { diagnostics, outputs } = await withHook((imports) => imports.slice(0, 2));
    expect(diagnostics).toEqual([]);
    expect(outputs.vue![0]!.contents).not.toContain("virtual:c.css");
  });

  it.each<[string, (imports: PassThroughImport[]) => PassThroughImport[]]>([
    ["add one", (imports) => [...imports, { ...imports[1]!, specifier: "virtual:d.css" }]],
    ["duplicate one", (imports) => [...imports, imports[2]!]],
    ["reorder them", ([a, b, c]) => [a!, c!, b!]],
    ["change one", ([a, b, c]) => [a!, { ...b!, specifier: "virtual:other.css" }, c!]],
  ])("may not %s", async (_, change) => {
    const { diagnostics } = await withHook(change);
    expect(diagnostics.map(({ code, message }) => [code, message])).toEqual([
      [
        "UF8001",
        expect.stringContaining("must be an import the analyser passed through, in its order"),
      ],
    ]);
  });
});
