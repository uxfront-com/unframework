// A case of two sources (ADR-0057), compiled for real: how the compile project joins their
// diagnostics and their golden files. The fixture is its own, so the rules hold whatever the
// corpus has.
import { compile, TARGET_NAMES } from "@unframework/compiler";
import { describe, expect, it } from "vitest";

import type { CaseSource } from "./cases.ts";
import { caseDiagnostics, caseOutputs, sourceTexts } from "./sources.ts";
import type { SourceCompile } from "./sources.ts";

const FORM = [
  "export default function Form() {",
  '  return <form aria-label="Sign in"><button type="submit">Send</button></form>;',
  "}",
  "",
].join("\n");
const FIELD = [
  "export default function Field() {",
  '  return <p class="field">Ada</p>;',
  "}",
  "",
].join("\n");
// UF1104: two components whose names differ only in case.
const SHOUTING = [
  "export function Card() {",
  "  return <p>Card</p>;",
  "}",
  "",
  "export function CARD() {",
  "  return <p>Shouting card</p>;",
  "}",
  "",
].join("\n");

const source = (name: string, ir = `ir.${name}.json`): CaseSource => ({
  source: `/corpus/forms/form/${name}.uf.tsx`,
  filename: `forms/form/${name}.uf.tsx`,
  ir,
});

async function compileCase(
  files: readonly (readonly [CaseSource, string])[],
): Promise<SourceCompile[]> {
  return Promise.all(
    files.map(async ([each, text]) => ({
      source: each,
      text,
      result: await compile(text, { filename: each.filename, targets: TARGET_NAMES }),
    })),
  );
}

describe("a case of two sources", () => {
  it("joins every source's output files in one tree per target", async () => {
    const compiles = await compileCase([
      [source("Field"), FIELD],
      [source("Form", "ir.json"), FORM],
    ]);
    expect(caseDiagnostics(compiles)).toEqual([]);
    const paths = Object.fromEntries(
      TARGET_NAMES.map((target) => {
        const { files, problems } = caseOutputs(compiles, target);
        expect(problems).toEqual([]);
        return [target, [...files.keys()]];
      }),
    );
    expect(paths).toEqual({
      react: ["Field.tsx", "Form.tsx"],
      vue: ["Field.vue", "Form.vue"],
      svelte: ["Field.svelte", "Form.svelte"],
      solid: ["Field.tsx", "Form.tsx"],
      angular: ["field.ts", "form.ts"],
      qwik: ["Field.tsx", "Form.tsx"],
      astro: ["Field.astro", "Form.astro"],
    });
    expect(caseOutputs(compiles, "vue").files.get("Field.vue")).toBe(
      compiles[0]!.result.outputs.vue![0]!.contents,
    );
  });

  it("joins every source's diagnostics, sorted by file, then by span, each with its text", async () => {
    // Two sources with diagnostics, given out of file order: Stamps before Cards.
    const stamps = SHOUTING.replaceAll("Card", "Stamp").replaceAll("CARD", "STAMP");
    const compiles = await compileCase([
      [source("Form", "ir.json"), FORM],
      [source("Stamps"), stamps],
      [source("Cards"), SHOUTING],
      [source("Field"), FIELD],
    ]);
    const diagnostics = caseDiagnostics(compiles);
    expect(
      diagnostics.map((diagnostic) => [diagnostic.file, diagnostic.code, diagnostic.span.start]),
    ).toEqual([
      ["forms/form/Cards.uf.tsx", "UF1104", expect.any(Number)],
      ["forms/form/Stamps.uf.tsx", "UF1104", expect.any(Number)],
    ]);
    expect([...sourceTexts(compiles).keys()]).toEqual([
      "forms/form/Form.uf.tsx",
      "forms/form/Stamps.uf.tsx",
      "forms/form/Cards.uf.tsx",
      "forms/form/Field.uf.tsx",
    ]);
  });

  it("refuses two sources whose files differ only in case", async () => {
    const compiles = await compileCase([
      [source("Upper", "ir.json"), "export default function FooBar() {\n  return <p>a</p>;\n}\n"],
      [source("Shout"), "export default function FOOBAR() {\n  return <p>b</p>;\n}\n"],
    ]);
    // Angular names its files in kebab-case: `foo-bar.ts` and `foobar.ts` differ.
    for (const target of TARGET_NAMES) {
      expect(caseOutputs(compiles, target).problems).toHaveLength(target === "angular" ? 0 : 1);
    }
    expect(caseOutputs(compiles, "vue").problems).toEqual([
      "forms/form/Upper.uf.tsx and forms/form/Shout.uf.tsx both produce vue/FOOBAR.vue: the components of a case need names of their own on every target.",
    ]);
  });

  it("refuses two sources that produce one file", async () => {
    const card = (label: string) =>
      `export default function Card() {\n  return <p>${label}</p>;\n}\n`;
    const compiles = await compileCase([
      [source("Card", "ir.json"), card("One")],
      [source("Copy"), card("Two")],
    ]);
    const { files, problems } = caseOutputs(compiles, "vue");
    expect([...files.keys()]).toEqual(["Card.vue"]);
    expect(problems).toEqual([
      "forms/form/Card.uf.tsx and forms/form/Copy.uf.tsx both produce vue/Card.vue: the components of a case need names of their own on every target.",
    ]);
  });
});
