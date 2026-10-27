import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { TypeOracle } from "@unframework/type-oracle";
import { describe, expect, it } from "vitest";

import { compile, createFileResolver, createSyntacticOracle } from "../src/index.ts";

/** A project on disk that holds a package, as a package manager installs it. */
const PACKAGE_TYPES = fileURLToPath(new URL("fixtures/package-types", import.meta.url));

/** A syntactic oracle over the fixture project, with sources held in memory over it. */
function diskOracle(sources: Record<string, string>): TypeOracle {
  return createSyntacticOracle({
    root: PACKAGE_TYPES,
    readFile: async (path) => {
      const file = path.startsWith(`${PACKAGE_TYPES}/`) ? path.slice(PACKAGE_TYPES.length + 1) : "";
      return sources[file] ?? readFile(path, "utf8").catch(() => undefined);
    },
  });
}

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

describe("props types across files and packages", () => {
  it("reads a package's props type, and lists each file and package it read once, sorted", async () => {
    const source = [
      'import type { KitProps } from "ui-kit";',
      'import type { LocalProps } from "./local.ts";',
      "export function A({ id, tone, label }: KitProps & LocalProps) {",
      "  return <p id={id} class={tone}>{label}</p>;",
      "}",
      "export function B(props: KitProps) {",
      "  return <p id={props.id}>b</p>;",
      "}",
    ].join("\n");
    const oracle = diskOracle({ "A.uf.tsx": source });
    const result = await compile(source, { filename: "A.uf.tsx", targets: [], typeOracle: oracle });
    expect(result.diagnostics).toEqual([]);
    expect(result.dependencies).toEqual(["local.ts", "pkg:ui-kit"]);
    expect(
      result.ir!.components[0]!.props.map(({ name, declaredBy }) => [name, declaredBy?.file]),
    ).toEqual([
      ["id", "pkg:ui-kit/types/index.d.ts"],
      ["tone", "pkg:ui-kit/types/index.d.ts"],
      ["label", "local.ts"],
    ]);
    expect(result.ir!.typeImports!.map(({ specifier }) => specifier)).toEqual([
      "ui-kit",
      "./local.ts",
    ]);
    await oracle.dispose();
  });

  it("reads a props type a `.uf.tsx` module exports, imported with or without its component", async () => {
    const field = [
      "export interface FieldProps { label: string; hint?: string }",
      "export default function Field({ label }: FieldProps) { return <span>{label}</span>; }",
    ].join("\n");
    const sources = (main: string): Record<string, string> => ({
      "Field.uf.tsx": field,
      "Form.uf.tsx": main,
    });
    for (const main of [
      'import type { FieldProps } from "./Field.uf.tsx";\nexport function Form(props: FieldProps) { return <p>{props.label}</p>; }',
      'import Field, { type FieldProps } from "./Field.uf.tsx";\nexport function Form(props: FieldProps) { return <Field label={props.label} />; }',
    ]) {
      const files = sources(main);
      const read = async (path: string) => files[path.slice("/project/".length)];
      const result = await compile(main, {
        filename: "Form.uf.tsx",
        targets: [],
        typeOracle: createSyntacticOracle({ root: "/project", readFile: read }),
        resolve: createFileResolver({ root: "/project", readFile: read }),
      });
      expect(result.diagnostics).toEqual([]);
      expect(result.ir!.typeImports).toEqual([
        {
          specifier: "./Field.uf.tsx",
          names: [{ imported: "FieldProps", local: "FieldProps", span: expect.any(Object) }],
          span: { start: 0, end: main.indexOf("\n") },
        },
      ]);
      expect(
        result.ir!.components[0]!.props.map(({ name, optional, declaredBy }) => [
          name,
          optional,
          declaredBy?.file,
        ]),
      ).toEqual([
        ["label", false, "Field.uf.tsx"],
        ["hint", true, "Field.uf.tsx"],
      ]);
      expect(result.dependencies).toEqual(["Field.uf.tsx"]);
    }
  });

  it.each([
    [
      "Partial<ButtonProps>",
      [
        ["label", true],
        ["tone", true],
      ],
    ],
    [
      "Required<ButtonProps>",
      [
        ["label", false],
        ["tone", false],
      ],
    ],
    ['Pick<ButtonProps, "label">', [["label", false]]],
    ['Omit<ButtonProps, "label">', [["tone", true]]],
    [
      "Readonly<ButtonProps>",
      [
        ["label", false],
        ["tone", true],
      ],
    ],
  ])("reads %s over an imported type", async (type, props) => {
    const source = [
      'import type { ButtonProps } from "./types.ts";',
      `export function A(props: ${type}) { return <p />; }`,
    ].join("\n");
    const result = await compile(source, {
      filename: "A.uf.tsx",
      targets: [],
      typeOracle: memoryOracle({ "A.uf.tsx": source, "types.ts": TYPES }),
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.ir!.components[0]!.props.map(({ name, optional }) => [name, optional])).toEqual(
      props,
    );
  });
});
