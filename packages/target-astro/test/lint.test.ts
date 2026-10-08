// L5 for Astro (ADR-0042): oxlint with the shared baseline over the frontmatter, and ESLint with
// eslint-plugin-astro over the whole file (tests/toolchains/astro). It accepts every committed
// golden and the shapes M1 emits, rejects what its rules exist for, accepts the class
// expressions the author writes, and refuses a run it cannot trust.
import { globSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolchainContext } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { M1_SHAPES, M2_SHAPES } from "./lint-probes.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const repo = join(packageDir, "../..");
const context: ToolchainContext = {
  toolchainDir: join(repo, "tests/toolchains/astro"),
  root: packageDir,
};

/** Every committed Astro golden output of the corpus. */
const goldens = globSync("tests/integration/cases/**/__output__/astro/**/*.astro", { cwd: repo })
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
  const [path] = write({ "Probe.astro": contents });
  const messages = (await toolchain.lint([path!], context)).get(path!) ?? [];
  return messages.map((message) => message.code ?? message.message).toSorted();
}

const FRONTMATTER = [
  "interface Props {",
  "  label: string;",
  "  size: string;",
  "  on?: boolean;",
  "}",
  "",
  "const { label, size, on } = Astro.props;",
  "",
].join("\n");

/** A component with `markup`, whose props are `label`, `size` and `on`. */
const component = (markup: string, frontmatter = FRONTMATTER) =>
  `---\n${frontmatter}---\n\n${markup}\n`;

describe("astro lint (L5)", { timeout: 60_000 }, () => {
  // It checks every committed golden output, so its time grows with the corpus.
  it("accepts every committed golden output, with no message", async () => {
    expect(goldens.map((file) => file.split("/").at(-1))).toEqual(
      expect.arrayContaining(["Hello.astro", "ProfileCard.astro"]),
    );
    const results = await toolchain.lint(goldens, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(goldens.map((file) => [file, []])),
    );
  }, 60_000);

  it.each([
    ["M1", "ADR-0034 to ADR-0040", M1_SHAPES],
    ["M2", "ADR-0045 to ADR-0049", M2_SHAPES],
  ] as const)("accepts the shapes %s emits (%s)", async (_milestone, _section, shapes) => {
    const files = write(shapes);
    const results = await toolchain.lint(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  it.each([
    {
      what: "a class binding without `class:list`",
      markup: "<p class={label} data-on={on}>{size}</p>",
      rule: "astro/prefer-class-list-directive",
    },
    {
      what: "raw HTML",
      markup: "<p set:html={label} data-on={on} title={size} />",
      rule: "astro/no-set-html-directive",
    },
    {
      what: "text through a directive",
      markup: "<p set:text={label} data-on={on} title={size} />",
      rule: "astro/no-set-text-directive",
    },
    {
      what: "a statement no output has a reason to hold",
      markup: "<p data-on={on} title={size}>{label}</p>",
      frontmatter: `${FRONTMATTER}debugger;\n`,
      rule: "no-debugger",
    },
    {
      // Why the setup keeps only what the server render reaches (ADR-0046): a function
      // only a handler called, copied, would be unused.
      what: "a function nothing calls",
      markup: "<p data-on={on} title={size}>{label}</p>",
      frontmatter: `${FRONTMATTER}function toggle() {\n  return !on;\n}\n`,
      rule: "@typescript-eslint/no-unused-vars",
    },
    {
      // astro-eslint-parser counts Astro's read of `Props` only in a file that names `Astro`:
      // a component that reads no prop exports it (src/frontmatter.ts).
      what: "a `Props` nothing reads",
      markup: "<p>x</p>",
      frontmatter: "interface Props {\n  label: string;\n}\n",
      rule: "@typescript-eslint/no-unused-vars",
    },
  ])("rejects $what ($rule)", async ({ markup, frontmatter, rule }) => {
    expect(await lintCodes(component(markup, frontmatter))).toEqual([rule]);
  });

  it("accepts an exported `Props` nothing reads, which is the component's API", async () => {
    const frontmatter = "export interface Props {\n  label: string;\n}\n";
    expect(await lintCodes(component("<p>x</p>", frontmatter))).toEqual([]);
  });

  it.each([
    {
      what: "a conditional class",
      markup: '<p class:list={[on ? "on" : "off"]}>{label}{size}</p>',
    },
    {
      what: "a class template with a space",
      markup: "<p class:list={[`btn btn-${size}`]} data-on={on}>{label}</p>",
    },
  ])("accepts $what, which is the author's expression", async ({ markup }) => {
    expect(await lintCodes(component(markup))).toEqual([]);
  });

  it("refuses to run without its configuration, or over a file it cannot lint", async () => {
    const [probe, notes] = write({
      "Probe.astro": component("<p data-on={on} title={size}>{label}</p>"),
      "notes.txt": "Hi\n",
    });
    await expect(
      toolchain.lint([probe!], { toolchainDir: scratch, root: packageDir }),
    ).rejects.toThrow(/does not exist/);
    await expect(toolchain.lint([probe!, notes!], context)).rejects.toThrow(/skipped/);
  });
});
