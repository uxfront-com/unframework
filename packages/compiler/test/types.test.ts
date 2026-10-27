import type { TypeOracle } from "@unframework/type-oracle";
import { describe, expect, it } from "vitest";

import { compile, createSyntacticOracle } from "../src/index.ts";

/** A syntactic oracle over files held in memory, by their paths under `/project`. */
function memoryOracle(files: Record<string, string>): TypeOracle {
  return createSyntacticOracle({
    root: "/project",
    readFile: async (path) => files[path.slice("/project/".length)],
  });
}

const BUTTON = [
  'import type { ButtonProps } from "./types.ts";',
  "export default function Button({ label, tone }: ButtonProps) {",
  '  return <button type="button" class={tone}>{label}</button>;',
  "}",
].join("\n");

const TYPES = [
  "interface Base { tone?: string }",
  "export interface ButtonProps extends Base { label: string }",
].join("\n");

describe("compile() with a type oracle", () => {
  it("reads an imported props type through the oracle, and lists what it read", async () => {
    const oracle = memoryOracle({ "Button.uf.tsx": BUTTON, "types.ts": TYPES });
    const result = await compile(BUTTON, {
      filename: "Button.uf.tsx",
      targets: [],
      typeOracle: oracle,
    });
    expect(result.diagnostics).toEqual([]);
    expect(
      result.ir!.components[0]!.props.map(({ name, declaredBy }) => [
        name,
        declaredBy?.file,
        declaredBy?.declaration,
      ]),
    ).toEqual([
      ["label", "types.ts", "ButtonProps"],
      ["tone", "types.ts", "Base"],
    ]);
    expect(result.ir!.typeImports!.map(({ specifier }) => specifier)).toEqual(["./types.ts"]);
    expect(result.dependencies).toEqual(["types.ts"]);
    await oracle.dispose();
  });

  it("reads the source's own types without an oracle, and reports an imported one (UF6001)", async () => {
    const result = await compile(BUTTON, { filename: "Button.uf.tsx", targets: [] });
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["UF6001"]);
    expect(result.diagnostics[0]!.message).toBe(
      "`ButtonProps` cannot be resolved: the type oracle cannot read the module it is imported from.",
    );
    expect(result.dependencies).toEqual([]);
    const local = await compile(
      "interface Base { a: string }\ninterface P extends Base { b: string }\nexport function A(props: P) { return <p>{props.a}</p>; }",
      { filename: "A.uf.tsx", targets: [] },
    );
    expect(local.diagnostics).toEqual([]);
    expect(local.ir!.components[0]!.props.map(({ name }) => name)).toEqual(["b", "a"]);
  });

  it("reports an oracle that throws as UF9001, and analyses on", async () => {
    const oracle: TypeOracle = {
      resolveShape: () => Promise.reject(new Error("The checker crashed.")),
      printType: () => Promise.reject(new Error("unused")),
      update: async () => {},
      dispose: async () => {},
    };
    const result = await compile(BUTTON, {
      filename: "Button.uf.tsx",
      targets: [],
      typeOracle: oracle,
    });
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["UF9001", "UF6001"]);
    expect(result.diagnostics[0]!.message).toContain("The type oracle failed on `ButtonProps`");
  });
});
