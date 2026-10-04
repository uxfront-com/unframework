// L5 for Svelte (ADR-0042): oxlint with the shared baseline over the script block, and ESLint
// with eslint-plugin-svelte over the whole file (tests/toolchains/svelte). It accepts every
// committed golden and the shapes M1 emits, rejects what its rules exist for, accepts what the
// printer and the author decide, and refuses a run it cannot trust.
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
  toolchainDir: join(repo, "tests/toolchains/svelte"),
  root: packageDir,
};

/** Every committed Svelte golden output of the corpus. */
const goldens = globSync("tests/integration/cases/**/__output__/svelte/**/*.svelte", { cwd: repo })
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
  const [path] = write({ "Probe.svelte": contents });
  const messages = (await toolchain.lint([path!], context)).get(path!) ?? [];
  return messages.map((message) => message.code ?? message.message).toSorted();
}

const SCRIPT = "  let { items, label }: { items: string[]; label: string } = $props();\n";

/** A runes component with `markup`, whose props are `items` and `label`. */
const component = (markup: string, script = SCRIPT, lang = ' lang="ts"') =>
  `<svelte:options runes={true} />\n\n<script${lang}>\n${script}</script>\n\n${markup}\n`;

describe("svelte lint (L5)", { timeout: 60_000 }, () => {
  it("accepts every committed golden output, with no message", async () => {
    expect(goldens.map((file) => file.split("/").at(-1))).toEqual(
      expect.arrayContaining(["Hello.svelte", "ProfileCard.svelte"]),
    );
    const results = await toolchain.lint(goldens, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(goldens.map((file) => [file, []])),
    );
  });

  it("accepts the shapes M1 emits (design §5.3)", async () => {
    const files = write(M1_SHAPES);
    const results = await toolchain.lint(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  it.each([
    {
      what: "a list without a key",
      markup: "{#each items as item}<p>{item}{label}</p>{/each}",
      rule: "svelte/require-each-key",
    },
    {
      what: "raw HTML",
      markup: "<p>{@html label}{items.length}</p>",
      rule: "svelte/no-at-html-tags",
    },
    {
      what: "a script in another language",
      markup: "<p>{label}{items.length}</p>",
      lang: "",
      rule: "svelte/block-lang",
    },
    {
      what: "a statement no output has a reason to hold",
      markup: "<p>{label}{items.length}</p>",
      script: `${SCRIPT}  debugger;\n`,
      rule: "no-debugger",
    },
  ])("rejects $what ($rule)", async ({ markup, script, lang, rule }) => {
    const contents =
      lang === undefined
        ? component(markup, script)
        : component(markup, "  let { items, label } = $props();\n", lang);
    expect(await lintCodes(contents)).toEqual([rule]);
  });

  it("is not silenced by a comment in the markup", async () => {
    // ESLint's `noInlineConfig` does not reach eslint-plugin-svelte's own
    // `<!-- eslint-disable -->`.
    const markup = "<!-- eslint-disable -->\n<p>{@html label}{items.length}</p>";
    expect(await lintCodes(component(markup))).toEqual(["svelte/no-at-html-tags"]);
  });

  it.each([
    // The printer's spelling of whitespace Svelte would otherwise trim (ADR-0026).
    { what: "whitespace as a string-literal mustache", markup: '<p>{label}{" "}<b>!</b></p>' },
    { what: "a link to a path", markup: '<a href="/about">{label}</a>' },
    {
      what: "a prop the component never reads",
      markup: "<p>{label}</p>",
      script: "  let { label }: { items?: string[]; label: string } = $props();\n",
    },
  ])("accepts $what", async ({ markup, script }) => {
    const reads = script === undefined ? `${markup}\n<i>{items.length}</i>` : markup;
    expect(await lintCodes(component(reads, script))).toEqual([]);
  });

  it("refuses to run without its configuration, or over a file it cannot lint", async () => {
    const [probe, notes] = write({
      "Probe.svelte": component("<p>{label}{items.length}</p>"),
      "notes.txt": "Hi\n",
    });
    await expect(
      toolchain.lint([probe!], { toolchainDir: scratch, root: packageDir }),
    ).rejects.toThrow(/does not exist/);
    await expect(toolchain.lint([probe!, notes!], context)).rejects.toThrow(/skipped/);
  });
});
