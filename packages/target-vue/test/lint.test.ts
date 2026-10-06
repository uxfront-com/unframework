// L5 for Vue (ADR-0042): oxlint with the shared baseline over the script block, and ESLint with
// eslint-plugin-vue over the whole file (tests/toolchains/vue). It accepts every committed golden
// and the shapes M1 emits, rejects what its rules exist for (several of which fix how the
// emitter writes Vue), accepts what the author decides, and refuses a run it cannot trust.
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
  toolchainDir: join(repo, "tests/toolchains/vue"),
  root: packageDir,
};

/** Every committed Vue golden output of the corpus. */
const goldens = globSync("tests/integration/cases/**/__output__/vue/**/*.vue", { cwd: repo })
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
  const [path] = write({ "Probe.vue": contents });
  const messages = (await toolchain.lint([path!], context)).get(path!) ?? [];
  return messages.map((message) => message.code ?? message.message).toSorted();
}

/** A component with `template`, whose props are `items` and an optional `label`. */
const component = (template: string, script = SCRIPT) =>
  `<script setup lang="ts">\n${script}</script>\n\n<template>\n  ${template}\n</template>\n`;

const SCRIPT =
  "const { items, label = undefined } = defineProps<{ items: string[]; label?: string }>();\n";

describe("vue lint (L5)", { timeout: 60_000 }, () => {
  it("accepts every committed golden output, with no message", async () => {
    expect(goldens.map((file) => file.split("/").at(-1))).toEqual(
      expect.arrayContaining(["Hello.vue", "ProfileCard.vue"]),
    );
    const results = await toolchain.lint(goldens, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(goldens.map((file) => [file, []])),
    );
  });

  it("accepts the shapes M1 emits (design §5.2)", async () => {
    const files = write(M1_SHAPES);
    const results = await toolchain.lint(files, context);
    expect(Object.fromEntries(results)).toEqual(
      Object.fromEntries(files.map((file) => [file, []])),
    );
  });

  it.each([
    {
      what: "attributes out of Vue's order (`id` after another attribute)",
      template: '<input type="text" id="a" :title="label" :list="items.join()" />',
      rule: "vue/attributes-order",
    },
    {
      what: "attributes out of Vue's order (a condition after an attribute)",
      template: '<p class="x" v-if="label">{{ items.length }}</p>',
      rule: "vue/attributes-order",
    },
    {
      what: "attributes out of Vue's order (`:key` after another attribute)",
      template: '<p v-for="item in items" :title="label" :key="item">{{ item }}</p>',
      rule: "vue/attributes-order",
    },
    {
      what: "an optional destructured prop without a default",
      template: "<p>{{ label }}{{ items.length }}</p>",
      script: "const { items, label } = defineProps<{ items: string[]; label?: string }>();\n",
      rule: "vue/require-default-prop",
    },
    {
      what: "a destructured prop nothing reads, under its own name",
      template: "<p>{{ items.length }}</p>",
      rule: "@typescript-eslint/no-unused-vars",
    },
    {
      what: "a list without a key",
      template: '<p v-for="item in items">{{ item }}{{ label }}</p>',
      rule: "vue/require-v-for-key",
    },
    {
      what: "a condition and a list on one element",
      template: '<p v-for="item in items" v-if="label" :key="item">{{ item }}</p>',
      rule: "vue/no-use-v-if-with-v-for",
    },
    {
      what: "an index no expression reads",
      template: '<p v-for="(item, index) in items" :key="item">{{ item }}{{ label }}</p>',
      rule: "vue/no-unused-vars",
    },
    {
      what: "a script in another language",
      template: "<p>{{ label }}</p>",
      script: null,
      rule: "vue/block-lang",
    },
    {
      what: "a statement no output has a reason to hold",
      template: "<p>{{ label }}{{ items.length }}</p>",
      script: `${SCRIPT}debugger;\n`,
      rule: "no-debugger",
    },
  ])("rejects $what ($rule)", async ({ template, script, rule }) => {
    const contents =
      script === null
        ? `<script setup lang="js">\nconst label = "x";\n</script>\n\n<template>\n  ${template}\n</template>\n`
        : component(template, script);
    expect(await lintCodes(contents)).toEqual([rule]);
  });

  it("is not silenced by a comment in the template", async () => {
    // ESLint's `noInlineConfig` does not reach eslint-plugin-vue's own `<!-- eslint-disable -->`.
    const template = `<!-- eslint-disable -->\n  <p v-for="item in items">{{ item }}{{ label }}</p>`;
    expect(await lintCodes(component(template))).toEqual(["vue/require-v-for-key"]);
  });

  it.each([
    {
      what: "a list parameter that reuses a prop's name",
      template: '<p v-for="label in items" :key="label">{{ label }}</p>',
    },
    { what: "a loose equality", template: '<p v-if="label == null">{{ items.length }}</p>' },
  ])("accepts $what, which is the author's", async ({ template }) => {
    expect(
      await lintCodes(component(`${template}\n  <i>{{ label }}{{ items.length }}</i>`)),
    ).toEqual([]);
  });

  it("refuses to run without its configuration, or over a file it cannot lint", async () => {
    const [probe, notes] = write({
      "Probe.vue": component("<p>{{ label }}{{ items.length }}</p>"),
      "notes.txt": "Hi\n",
    });
    await expect(
      toolchain.lint([probe!], { toolchainDir: scratch, root: packageDir }),
    ).rejects.toThrow(/does not exist/);
    await expect(toolchain.lint([probe!, notes!], context)).rejects.toThrow(/skipped/);
  });
});
