// L5 for Qwik (ADR-0042): oxlint with the shared baseline and eslint-plugin-qwik as a JS plugin,
// without its type-aware rules (tests/toolchains/qwik/output.oxlintrc.json). It accepts every
// committed golden and the shapes M1 emits, rejects what its rules exist for, accepts the markup
// the author decides, and refuses a run it cannot trust.
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
  toolchainDir: join(repo, "tests/toolchains/qwik"),
  root: packageDir,
};

/** Every committed Qwik golden output of the corpus. */
const goldens = globSync("tests/integration/cases/**/__output__/qwik/**/*.tsx", { cwd: repo })
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
  const [path] = write({ "Probe.tsx": contents });
  const messages = (await toolchain.lint([path!], context)).get(path!) ?? [];
  return messages.map((message) => message.code ?? message.message).toSorted();
}

/** A `component$` of `{ items, label }` that returns `jsx`, with `body` before the return. */
const component = (jsx: string, body = "") =>
  [
    'import { component$ } from "@qwik.dev/core";',
    "",
    "export default component$<{ items: string[]; label: string }>(({ items, label }) => {",
    `${body}  return ${jsx};`,
    "});",
    "",
  ].join("\n");

describe("qwik lint (L5)", { timeout: 60_000 }, () => {
  it("accepts every committed golden output, with no message", async () => {
    expect(goldens.map((file) => file.split("/").at(-1))).toEqual(
      expect.arrayContaining(["Hello.tsx", "ProfileCard.tsx"]),
    );
    const results = await toolchain.lint(goldens, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(goldens.map((file) => [file, []])),
    );
  });

  it("accepts the shapes M1 emits (design §5.6)", async () => {
    const files = write(M1_SHAPES);
    const results = await toolchain.lint(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  it.each([
    {
      what: "React's attribute names",
      contents: component('<p className="x">{label}{items.length}</p>'),
      rule: "qwik/no-react-props",
    },
    {
      what: "a list item without a key",
      contents: component("<ul>{items.map((item) => <li>{item}{label}</li>)}</ul>"),
      rule: "qwik/jsx-key",
    },
    {
      what: "a destructured prop no expression reads",
      contents: component("<p>{label}</p>"),
      rule: "no-unused-vars",
    },
    {
      what: "a statement no output has a reason to hold",
      contents: component("<p>{label}{items.length}</p>", "  debugger;\n"),
      rule: "no-debugger",
    },
  ])("rejects $what ($rule)", async ({ contents, rule }) => {
    expect(await lintCodes(contents)).toEqual([rule]);
  });

  it.each([
    { what: "an image without a size", jsx: '<img src="/a.png" alt={label} />' },
    { what: "a link without an href", jsx: "<a>{label}</a>" },
  ])("accepts $what, which is the author's markup", async ({ jsx }) => {
    expect(await lintCodes(component(`<>\n${jsx}\n<i>{items.length}</i>\n</>`))).toEqual([]);
  });

  it("refuses to run without its configuration, or over a file it cannot lint", async () => {
    const [probe, notes] = write({
      "Probe.tsx": component("<p>{label}{items.length}</p>"),
      "notes.txt": "Hi\n",
    });
    await expect(
      toolchain.lint([probe!], { toolchainDir: scratch, root: packageDir }),
    ).rejects.toThrow(/output\.oxlintrc\.json does not exist/);
    await expect(toolchain.lint([probe!, notes!], context)).rejects.toThrow(
      /it linted 1 of the 2 files it was given, so it skipped some/,
    );
  });
});
