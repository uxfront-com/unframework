// What the preview lists and the controls it gives (ADR-0088, A4): the catalogue of the sample
// design system, the prop types that get a control, and the command's arguments.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readCatalogue } from "../src/preview/catalogue.ts";
import { parsePreviewArguments } from "../src/preview/command.ts";
import { controlOf, propControls, stringLiteral, unionMembers } from "../src/preview/controls.ts";
import { VisualUsageError } from "../src/run.ts";

const DESIGN_SYSTEM = fileURLToPath(new URL("../../../tests/e2e/design-system", import.meta.url));

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "uf-preview-"));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  }
  return root;
}

const member = (type: string, extra: { optional?: boolean; literals?: string[] } = {}) => ({
  name: "p",
  optional: extra.optional ?? false,
  type,
  ...(extra.literals ? { literals: extra.literals } : {}),
});

describe("controlOf", () => {
  it("gives boolean, string and number props their controls", () => {
    expect(controlOf(member("boolean"))).toEqual({
      name: "p",
      optional: false,
      kind: "boolean",
      initial: false,
    });
    expect(controlOf(member("string", { optional: true }))).toMatchObject({
      kind: "string",
      optional: true,
      initial: "",
    });
    expect(controlOf(member("number"))).toMatchObject({ kind: "number", initial: 0 });
    expect(controlOf(member("true | false"))).toMatchObject({ kind: "boolean" });
  });

  it("gives a union of string literals a select, as written or resolved from an alias", () => {
    expect(controlOf(member(`"primary" | 'secondary'`))).toMatchObject({
      kind: "select",
      options: ["primary", "secondary"],
      initial: "primary",
    });
    expect(
      controlOf(member("ButtonVariant", { optional: true, literals: ['"a"', '"b"'] })),
    ).toMatchObject({ kind: "select", optional: true, options: ["a", "b"] });
  });

  it("reads `| undefined` as an optional prop", () => {
    expect(controlOf(member("string | undefined"))).toMatchObject({
      kind: "string",
      optional: true,
    });
    expect(controlOf(member(`"x" | "y" | undefined`))).toMatchObject({
      kind: "select",
      optional: true,
      options: ["x", "y"],
    });
  });

  it.each([
    "() => void",
    "string[]",
    "Record<string, number>",
    "{ a: string }",
    "Tone",
    "1 | 2",
    `"a" | number`,
    "string | number",
    "`x-${string}`",
    `"a|b`,
    "null",
  ])("names %s as not controllable", (type) => {
    expect(controlOf(member(type))).toEqual(expect.stringContaining(type));
  });

  it("splits a union only at its top level, and keeps a literal's own bar", () => {
    expect(unionMembers(`"a|b" | "c"`)).toEqual([`"a|b"`, `"c"`]);
    expect(unionMembers(`| "a" | "b"`)).toEqual([`"a"`, `"b"`]);
    expect(unionMembers("Array<a | b>")).toBeUndefined();
    expect(unionMembers("a ||")).toBeUndefined();
    expect(stringLiteral(`"say \\"hi\\""`)).toBe('say "hi"');
    expect(stringLiteral(`'it\\'s'`)).toBe("it's");
    expect(stringLiteral(`"open`)).toBeUndefined();
    expect(stringLiteral("primary")).toBeUndefined();
  });

  it("keeps the members in order, and splits the uncontrolled out with the reason", () => {
    const { controls, uncontrolled } = propControls([
      { name: "label", optional: false, type: "string" },
      { name: "onPick", optional: true, type: "(id: string) => void" },
      { name: "size", optional: true, type: `"s" | "m"` },
    ]);
    expect(controls.map((each) => each.name)).toEqual(["label", "size"]);
    expect(uncontrolled).toEqual([
      {
        name: "onPick",
        type: "(id: string) => void",
        reason: expect.stringContaining("(id: string) => void"),
      },
    ]);
  });
});

describe("readCatalogue", () => {
  it("lists the design system's examples and its components, with their controls", async () => {
    const catalogue = await readCatalogue(DESIGN_SYSTEM, join(DESIGN_SYSTEM, "src"));
    expect(catalogue.examples.map((each) => each.id)).toEqual([
      "examples/Buttons",
      "examples/Card",
      "examples/TextField",
    ]);
    expect(catalogue.components.map((each) => [each.id, each.name])).toEqual([
      ["src/Button", "Button"],
      ["src/Card", "Card"],
      ["src/Counter", "Counter"],
      ["src/TextField", "TextField"],
    ]);
    const byId = Object.fromEntries(catalogue.components.map((each) => [each.id, each]));
    // `variant?: ButtonVariant`, an alias imported from `./types`: the oracle resolves it.
    expect(byId["src/Button"]!.controls).toEqual([
      {
        name: "variant",
        optional: true,
        kind: "select",
        options: ["primary", "secondary"],
        initial: "primary",
      },
    ]);
    expect(byId["src/Counter"]!.controls.map((each) => [each.name, each.kind])).toEqual([
      ["initial", "number"],
      ["step", "number"],
    ]);
    expect(byId["src/TextField"]!.controls).toEqual([
      { name: "label", optional: false, kind: "string", initial: "" },
    ]);
    expect(byId["src/Card"]!.controls).toEqual([]);
    for (const entry of [...catalogue.examples, ...catalogue.components]) {
      expect(entry.file.startsWith(DESIGN_SYSTEM), entry.file).toBe(true);
    }
  });

  it("leaves out an example, a file with no default export and one that does not compile", async () => {
    const root = project({
      "src/Shown.uf.tsx": "export default function Shown() {\n  return <p>Shown</p>;\n}\n",
      "src/Named.uf.tsx": "export function Named() {\n  return <p>Named</p>;\n}\n",
      "src/Broken.uf.tsx": "export default function Broken() {\n  return <p>{</p>;\n}\n",
      "src/Shown.example.uf.tsx": "export default function Ex() {\n  return <p>Ex</p>;\n}\n",
      "src/node_modules/Dep.uf.tsx": "export default function Dep() {\n  return <p/>;\n}\n",
      "src/.cache/Hidden.uf.tsx": "export default function Hidden() {\n  return <p/>;\n}\n",
    });
    const catalogue = await readCatalogue(root, join(root, "src"));
    expect(catalogue.components.map((each) => each.id)).toEqual(["src/Shown"]);
    expect(catalogue.examples.map((each) => each.id)).toEqual(["src/Shown"]);
    // The example beside its component shares its id, so each is keyed by its kind too.
    expect(catalogue.examples.map((each) => [each.key, each.file])).toEqual([
      ["example:src/Shown", join(root, "src/Shown.example.uf.tsx")],
    ]);
    expect(catalogue.components.map((each) => [each.key, each.file])).toEqual([
      ["component:src/Shown", join(root, "src/Shown.uf.tsx")],
    ]);
  });
});

describe("parsePreviewArguments", () => {
  it("reads targets and the port", () => {
    expect(parsePreviewArguments([])).toEqual({ targets: [] });
    expect(
      parsePreviewArguments(["--target", "react", "--target=vue", "--target", "react", "--port=0"]),
    ).toEqual({ targets: ["react", "vue"], port: 0 });
    expect(parsePreviewArguments(["--port", "5173"])).toEqual({ targets: [], port: 5173 });
  });

  it.each([
    [["--target", "preact"], "unknown target preact"],
    [["--target"], "--target needs a value"],
    [["--port", "--target"], "--port needs a value"],
    [["--port="], "--port needs a value"],
    [["--port", "80.5"], "--port takes a whole number"],
    [["--port", "65536"], "--port takes a whole number"],
    [["--port", "1", "--port", "2"], "--port is given twice"],
    [["--watch"], 'unknown argument "--watch"'],
  ])("refuses %j", (args, message) => {
    expect(() => parsePreviewArguments(args)).toThrow(VisualUsageError);
    expect(() => parsePreviewArguments(args)).toThrow(message);
  });
});
