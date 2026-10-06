// The Svelte dialect against design §1: the shared markup cases (codegen/test/markup-cases.ts),
// printed with `svelteDialect`, wrapped in a runes-mode component that declares their props as
// design §5.3 does, compiled by Svelte's own compiler as vite-plugin-svelte compiles it, rendered
// by `svelte/server`, then linted with the target's L5 rules. The emitter's own output is tested
// once the Svelte lane lands it (wave 3).
import { join } from "node:path";

import { printMarkup, svelteDialect } from "@unframework/codegen";
import type { MarkupOptions } from "@unframework/codegen";
import type { Component } from "svelte";
import { compile } from "svelte/compiler";
import { afterAll, describe, expect, it } from "vitest";

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
import { renderToString } from "../src/toolchain/server.ts";
import { importScratch, removeScratch, repoRoot, writeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** A runes-mode component around the markup, with the options the target pins. */
function wrap(markup: string, { props }: Suite): string {
  return [
    "<svelte:options runes={true} preserveWhitespace={false} />",
    "",
    `<script lang="ts">`,
    `  let { ${props.map(({ name }) => name).join(", ")} }: {`,
    ...props.map(({ name, type }) => `    ${name}?: ${type};`),
    `  } = $props();`,
    `</script>`,
    "",
    markup,
    "",
  ].join("\n");
}

/** The suite's component and each root case's, printed with `layout`. */
function components(layout: MarkupOptions): { cases: Suite; source: string }[] {
  return [suite(MARKUP_CASES), ...ROOT_CASES.map((each) => suite([each], "self"))].map((cases) => ({
    cases,
    source: wrap(
      printMarkup(cases.component.render, svelteDialect, {
        ...layout,
        component: cases.component,
        rewrite: cases.rules(false),
      }),
      cases,
    ),
  }));
}

let compiled = 0;

/**
 * Compiles a component for the server and the client and renders it on the server, failing on
 * any compiler warning; `preserveWhitespace` is the consumer's option, which the component's
 * own overrides.
 */
async function render(
  source: string,
  props: Record<string, unknown>,
  preserveWhitespace: boolean,
): Promise<string> {
  const filename = `Markup${compiled++}.svelte`;
  const server = compile(source, { filename, generate: "server", preserveWhitespace });
  const client = compile(source, { filename, generate: "client", preserveWhitespace });
  const warnings = [...server.warnings, ...client.warnings];
  expect(warnings.map(({ code, message }) => `${code}: ${message}`)).toEqual([]);
  const { default: component } = await importScratch<{ default: Component }>(
    filename.replace(".svelte", ".js"),
    server.js.code,
  );
  return renderToString(component, { props });
}

describe.each<MarkupOptions & { preserveWhitespace: boolean }>([
  { preserveWhitespace: false },
  { printWidth: 30, preserveWhitespace: false },
  { preserveWhitespace: true },
])(
  "svelte markup (print width $printWidth, consumer's preserveWhitespace $preserveWhitespace)",
  ({ preserveWhitespace, ...layout }) => {
    it("renders every case as design §1 says", async () => {
      const { cases, source } = components(layout)[0]!;
      const html = await render(source, passedProps(cases.props), preserveWhitespace);
      for (const { name, expected, actual } of compareSuite(canonical(html), cases.cases)) {
        expect.soft(actual, name).toEqual(expected);
      }
    });

    it.each(ROOT_CASES.map((each, index) => [each.name, index + 1] as const))(
      "renders %s",
      async (_, index) => {
        const { cases, source } = components(layout)[index]!;
        const html = await render(source, passedProps(cases.props), preserveWhitespace);
        expect(canonical(html)).toEqual(canonical(ROOT_CASES[index - 1]!.expected));
      },
    );

    it("prints shapes the Svelte linters accept (L5)", { timeout: 60_000 }, async () => {
      const files = writeScratch(
        Object.fromEntries(
          components(layout).map(({ source }, index) => [`Case${index}.svelte`, source]),
        ),
      );
      const context = { toolchainDir: join(repoRoot, "tests/toolchains/svelte"), root: repoRoot };
      const linted = await toolchain.lint(Object.values(files), context);
      const messages = [...linted].flatMap(([file, found]) =>
        found.map(({ code, message }) => `${file.split("/").at(-1)}: ${code ?? message}`),
      );
      expect(messages).toEqual([]);
    });
  },
);
