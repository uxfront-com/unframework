// The Astro dialect against design §1: the shared markup cases (codegen/test/markup-cases.ts),
// printed with `astroDialect` after a frontmatter that reads their props as design §5.7 does,
// compiled by Astro's own compiler with Astro's defaults (`compressHTML: "jsx"`), rendered by the
// Container API, then linted with the target's L5 rules. The emitter's own output is tested once
// the Astro lane lands it (wave 3).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { astroDialect, printMarkup } from "@unframework/codegen";
import type { MarkupOptions } from "@unframework/codegen";
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
import { loadAstroComponent, scratchDirectory } from "./astro.ts";
import { integrationRoot, toolchainDir } from "./workspace.ts";

const scratch = scratchDirectory("markup-semantics");
afterAll(() => scratch.remove());

/** A component: the props read from `Astro.props` in the frontmatter, then the markup. */
function wrap(markup: string, { props }: Suite): string {
  return [
    "---",
    `const { ${props.map(({ name }) => name).join(", ")} } = Astro.props;`,
    "---",
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
      printMarkup(cases.component.render, astroDialect, {
        ...layout,
        component: cases.component,
        rewrite: cases.rules(false),
      }),
      cases,
    ),
  }));
}

/** Compiles (failing on any diagnostic) and renders a component on the server. */
async function render(source: string, props: Record<string, unknown>): Promise<string> {
  return renderToString(await loadAstroComponent(scratch.path, source), { props });
}

let linted = 0;

describe.each<MarkupOptions>([{}, { printWidth: 30 }])(
  "astro markup (print width $printWidth)",
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

    it("prints shapes the Astro linters accept (L5)", { timeout: 60_000 }, async () => {
      const directory = join(scratch.path, `lint-${linted++}`);
      mkdirSync(directory, { recursive: true });
      const files = components(layout).map(({ source }, index) => {
        const path = join(directory, `Case${index}.astro`);
        writeFileSync(path, source);
        return path;
      });
      const found = await toolchain.lint(files, { toolchainDir, root: integrationRoot });
      const messages = [...found].flatMap(([file, each]) =>
        each.map(({ code, message }) => `${file.split("/").at(-1)}: ${code ?? message}`),
      );
      expect(messages).toEqual([]);
    });
  },
);
