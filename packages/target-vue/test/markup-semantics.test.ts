// The Vue dialect against design §1: the shared markup cases (codegen/test/markup-cases.ts),
// printed with `vueDialect`, wrapped in a `<script setup>` that declares their props as design
// §5.2 does, compiled by @vue/compiler-sfc as @vitejs/plugin-vue compiles it and rendered by Vue's
// server renderer, then linted with the target's L5 rules. Vue is the reference target (D10), so
// what it renders here is what every target must. The emitter's own output is tested once the Vue
// lane lands it (wave 3).
import { join } from "node:path";

import { printMarkup, vueDialect } from "@unframework/codegen";
import type { MarkupOptions } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";
import { createSSRApp } from "vue";
import type { Component } from "vue";
import { compileScript, parse } from "vue/compiler-sfc";
import { renderToString } from "vue/server-renderer";

import {
  canonical,
  compareSuite,
  MARKUP_CASES,
  passedProps,
  ROOT_CASES,
  suite,
} from "../../codegen/test/markup-cases.ts";
import type { Suite } from "../../codegen/test/markup-cases.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { importScratch, removeScratch, repoRoot, writeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** A component around the markup: every prop optional, with `= undefined` (design §5.2). */
function sfc(markup: string, { props }: Suite): string {
  return [
    `<script setup lang="ts">`,
    `const {`,
    ...props.map(({ name }) => `  ${name} = undefined,`),
    `} = defineProps<{`,
    ...props.map(({ name, type }) => `  ${name}?: ${type};`),
    `}>();`,
    `</script>`,
    ``,
    `<template>`,
    markup,
    `</template>`,
    ``,
  ].join("\n");
}

/** The suite's component and each root case's, printed with `layout`. */
function components(layout: MarkupOptions): { cases: Suite; source: string }[] {
  return [suite(MARKUP_CASES), ...ROOT_CASES.map((each) => suite([each], "self"))].map((cases) => ({
    cases,
    source: sfc(
      printMarkup(cases.component.render, vueDialect, {
        ...layout,
        level: 1,
        component: cases.component,
        rewrite: cases.rules(false),
      }),
      cases,
    ),
  }));
}

let compiled = 0;

/** Compiles and server-renders a component, failing on any warning from the compiler or Vue. */
async function render(source: string, props: Record<string, unknown>): Promise<string> {
  const id = `markup-${compiled++}`;
  const { descriptor, errors } = parse(source, { filename: `${id}.vue` });
  expect(errors).toEqual([]);
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
  let code: string;
  try {
    ({ content: code } = compileScript(descriptor, {
      id,
      inlineTemplate: true,
      templateOptions: {
        ssr: true,
        ssrCssVars: [],
        transformAssetUrls: false,
        compilerOptions: { onWarn: (warning) => void warnings.push(warning.message) },
      },
    }));
  } finally {
    console.warn = warn;
  }
  const { default: component } = await importScratch<{ default: Component }>(`${id}.ts`, code);
  const app = createSSRApp(component, props);
  app.config.warnHandler = (message) => void warnings.push(message);
  const html = await renderToString(app);
  expect(warnings).toEqual([]);
  return html;
}

describe.each<MarkupOptions>([{}, { printWidth: 30 }])(
  "vue markup (print width $printWidth)",
  (layout) => {
    it("renders every case as design §1 says", async () => {
      const { cases, source } = components(layout)[0]!;
      const html = await render(source, passedProps(cases.props));
      for (const { name, expected, actual } of compareSuite(canonical(html), cases.cases)) {
        expect.soft(actual, name).toEqual(expected);
      }
    });

    it.each(ROOT_CASES.map((each, index) => [each.name, index + 1] as const))(
      "renders %s",
      async (_, index) => {
        const { cases, source } = components(layout)[index]!;
        const html = await render(source, passedProps(cases.props));
        expect(canonical(html)).toEqual(canonical(ROOT_CASES[index - 1]!.expected));
      },
    );

    it("prints shapes the Vue linters accept (L5)", { timeout: 60_000 }, async () => {
      const files = writeScratch(
        Object.fromEntries(
          components(layout).map(({ source }, index) => [`Case${index}.vue`, source]),
        ),
      );
      const context = { toolchainDir: join(repoRoot, "tests/toolchains/vue"), root: repoRoot };
      const linted = await toolchain.lint(Object.values(files), context);
      const messages = [...linted].flatMap(([file, found]) =>
        found.map(({ code, message }) => `${file.split("/").at(-1)}: ${code ?? message}`),
      );
      expect(messages).toEqual([]);
    });
  },
);
