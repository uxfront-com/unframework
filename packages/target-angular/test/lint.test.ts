// L5 for Angular (ADR-0042): oxlint with the shared baseline over the TypeScript, and ESLint
// with angular-eslint over the file and its inline template (tests/toolchains/angular). It
// accepts every committed golden and the shapes M1 emits, rejects what its rules exist for
// (several of which fix how the emitter writes Angular), accepts what the author decides, and
// refuses a run it cannot trust.
import { globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolchainContext } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { M1_SHAPES } from "./lint-probes.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repo = join(packageDir, "../..");
const context: ToolchainContext = {
  toolchainDir: join(repo, "tests/toolchains/angular"),
  root: packageDir,
};

/** Every committed Angular golden output of the corpus. */
const goldens = globSync("tests/integration/cases/**/__output__/angular/**/*.ts", { cwd: repo })
  .toSorted()
  .map((file) => join(repo, file));

mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
const scratch = mkdtempSync(join(packageDir, ".uf-tmp", "lint-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

let directories = 0;
/** Writes files into a directory of their own and returns their paths, in order. */
function write(files: Record<string, string>): string[] {
  const directory = join(scratch, String(directories++));
  mkdirSync(directory);
  return Object.entries(files).map(([name, contents]) => {
    const path = join(directory, name);
    writeFileSync(path, contents);
    return path;
  });
}

/** The codes of every message on one component, sorted. */
async function lintCodes(contents: string): Promise<string[]> {
  const [path] = write({ "probe.ts": contents });
  const messages = (await toolchain.lint([path!], context)).get(path!) ?? [];
  return messages.map((message) => message.code ?? message.message).toSorted();
}

const MEMBERS = [
  "  readonly label = input.required<string>();",
  "  readonly items = input.required<string[]>();",
].join("\n");

/** A component with `template`, whose inputs are `label` and `items`. */
const component = (
  template: string,
  { selector = "uf-probe", members = MEMBERS, imports = "Component, input" } = {},
) =>
  [
    `import { ${imports} } from "@angular/core";`,
    "",
    "@Component({",
    `  selector: "${selector}",`,
    '  host: { style: "display: contents" },',
    "  preserveWhitespaces: false,",
    `  template: \`\n    ${template}\n  \`,`,
    "})",
    "export default class Probe {",
    members,
    "}",
    "",
  ].join("\n");

describe("angular lint (L5)", { timeout: 60_000 }, () => {
  it("accepts every committed golden output, with no message", async () => {
    expect(goldens.map((file) => file.split("/").at(-1))).toEqual(
      expect.arrayContaining(["hello.ts", "profile-card.ts"]),
    );
    const results = await toolchain.lint(goldens, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(goldens.map((file) => [file, []])),
    );
  });

  it("accepts the shapes M1 emits (design §5.5)", async () => {
    const files = write(M1_SHAPES);
    const results = await toolchain.lint(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  it.each([
    {
      what: "a structural directive",
      contents: component('<p *ngIf="label()">{{ items().length }}</p>'),
      rule: "@angular-eslint/template/prefer-control-flow",
    },
    {
      what: "a decorator input",
      contents: component("<p>{{ label }}</p>", {
        members: '  @Input() label = "";',
        imports: "Component, Input",
      }),
      rule: "@angular-eslint/prefer-signals",
    },
    {
      what: "a selector without the `uf` prefix",
      contents: component("<p>{{ label() }}{{ items().length }}</p>", { selector: "app-probe" }),
      rule: "@angular-eslint/component-selector",
    },
    {
      what: "an interpolated attribute",
      contents: component('<p title="{{ label() }}">{{ items().length }}</p>'),
      rule: "@angular-eslint/template/no-interpolation-in-attributes",
    },
    {
      what: "an empty control-flow block",
      contents: component("@if (label()) {} @else {\n      <p>{{ items().length }}</p>\n    }"),
      rule: "@angular-eslint/template/no-empty-control-flow",
    },
    {
      what: "an attribute bound twice",
      contents: component(
        '<p [attr.title]="label()" [attr.title]="label()">{{ items().length }}</p>',
      ),
      rule: "@angular-eslint/template/no-duplicate-attributes",
      // Once for each of the two.
      times: 2,
    },
    {
      what: "a statement no output has a reason to hold",
      contents: component("<p>{{ label() }}{{ items().length }}</p>", {
        members: `${MEMBERS}\n  constructor() {\n    debugger;\n  }`,
      }),
      rule: "no-debugger",
    },
  ])("rejects $what ($rule)", async ({ contents, rule, times = 1 }) => {
    expect(await lintCodes(contents)).toEqual(Array.from({ length: times }, () => rule));
  });

  it.each([
    { what: "a loose equality", template: "@if (label() == null) {\n      <b>none</b>\n    }" },
    {
      // Angular's styling precedence: the binding adds to the static value (design §5.5).
      what: "a static class and style beside their bindings",
      template:
        '<p class="a" [class]="label()" style="color: red" [style.margin-top]="label()"></p>',
    },
    {
      what: "a list with an aliased index",
      template:
        "@for (item of items(); track item; let index = $index) {\n      <i>{{ index }}{{ item }}</i>\n    }",
    },
  ])("accepts $what", async ({ template }) => {
    const reads = `${template}\n    <i>{{ label() }}{{ items().length }}</i>`;
    expect(await lintCodes(component(reads))).toEqual([]);
  });

  it("refuses to run without its configuration, or over a file it cannot lint", async () => {
    const [probe, notes] = write({
      "probe.ts": component("<p>{{ label() }}{{ items().length }}</p>"),
      "notes.txt": "Hi\n",
    });
    await expect(
      toolchain.lint([probe!], { toolchainDir: scratch, root: packageDir }),
    ).rejects.toThrow(/does not exist/);
    await expect(toolchain.lint([probe!, notes!], context)).rejects.toThrow(/skipped/);
  });
});
