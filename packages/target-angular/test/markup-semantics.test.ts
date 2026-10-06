// The Angular dialect against design §1: the shared markup cases (codegen/test/markup-cases.ts),
// printed with `angularDialect` and a rewrite that reads each prop's signal input by calling it,
// in a component that declares them as design §5.5 does, compiled by ngtsc (the `ssr:angular`
// project's plugin, with its extended diagnostics), rendered by Angular's server platform, then
// linted with the target's L5 rules. The dialect prints a reference however the target spells
// it: the emitter reads props through `@let` variables instead (src/template.ts), whose output
// test/output.test.ts and the corpus render.
// Angular's own packages ship partially compiled; in this plain-Node project the JIT compiler
// finishes them as they load (see render-parity.test.ts).
// oxlint-disable-next-line import/no-unassigned-import -- loaded for its side effect
import "@angular/compiler";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { format as formatMessage } from "node:util";

import { angularDialect, printMarkup } from "@unframework/codegen";
import type { MarkupOptions } from "@unframework/codegen";
import { afterAll, describe, expect, it, vi } from "vitest";

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
import { context, ngtscPlugin, removeScratch, scratchDir } from "./helpers.ts";

afterAll(removeScratch);

/** Text inside a JavaScript template literal, as `js.templateLiteral` writes it. */
const templateText = (text: string) =>
  text.replace(/[\\`]/g, (character) => `\\${character}`).replace(/\$\{/g, "\\${");

/**
 * A component around the markup: a required input for each prop a case passes, an optional one
 * for each it leaves out, and a member for each allowed global the expressions read.
 */
function wrap(markup: string, { props, globals }: Suite): string {
  return [
    `import { Component, input } from "@angular/core";`,
    "",
    "@Component({",
    `  selector: "uf-cases",`,
    `  host: { style: "display: contents" },`,
    "  preserveWhitespaces: false,",
    `  template: \`\n${templateText(markup)}\n  \`,`,
    "})",
    "export default class Cases {",
    ...props.map(({ name, type, passed }) =>
      passed
        ? `  readonly ${name} = input.required<${type}>();`
        : `  readonly ${name} = input<${type} | undefined>();`,
    ),
    ...globals.map((name) => `  protected readonly ${name} = ${name};`),
    "}",
    "",
  ].join("\n");
}

/** The suite's component and each root case's, printed with `layout`. */
function components(layout: MarkupOptions): { cases: Suite; source: string }[] {
  return [suite(MARKUP_CASES), ...ROOT_CASES.map((each) => suite([each], "self"))].map((cases) => ({
    cases,
    source: wrap(
      printMarkup(cases.component.render, angularDialect, {
        ...layout,
        level: 2,
        component: cases.component,
        rewrite: cases.rules(true),
      }),
      cases,
    ),
  }));
}

let compiled = 0;

/**
 * Compiles and server-renders a component, and returns what its host element holds. ngtsc's
 * warnings (extended diagnostics such as NG8102 and NG8107, which fail L3) and anything Angular
 * logs fail it.
 */
async function render(source: string, props: Record<string, unknown>): Promise<string> {
  const directory = scratchDir();
  const { transform, warnings } = await ngtscPlugin();
  const { code } = await transform(join(directory, `Cases${compiled}.uf.tsx.ts`), source);
  const file = join(directory, `cases-${compiled++}.js`);
  writeFileSync(file, code);
  const loaded: unknown = await import(pathToFileURL(file).href);
  if (typeof loaded !== "object" || loaded === null || !("default" in loaded)) {
    throw new Error(`${file} has no default export.`);
  }
  const component = loaded.default;
  const logged: string[] = [];
  const capture = (...args: unknown[]) => void logged.push(formatMessage(...args));
  const spies = [
    vi.spyOn(console, "error").mockImplementation(capture),
    vi.spyOn(console, "warn").mockImplementation(capture),
  ];
  let html: string;
  try {
    html = await renderToString(component, { props });
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  expect([...warnings, ...logged]).toEqual([]);
  const host = /^<uf-cases style="display: contents;">([\s\S]*)<\/uf-cases>$/.exec(html);
  expect(host, html).not.toBeNull();
  return host![1]!;
}

describe.each<MarkupOptions>([{}, { printWidth: 30 }])(
  "angular markup (print width $printWidth)",
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

    it("prints shapes the Angular linters accept (L5)", { timeout: 60_000 }, async () => {
      const directory = scratchDir();
      const files = components(layout).map(({ source }, index) => {
        const path = join(directory, `case-${index}.ts`);
        writeFileSync(path, source);
        return path;
      });
      const linted = await toolchain.lint(files, context);
      const messages = [...linted].flatMap(([file, found]) =>
        found.map(({ code, message }) => `${file.split("/").at(-1)}: ${code ?? message}`),
      );
      expect(messages).toEqual([]);
    });
  },
);
