// The Svelte output, formatted and not, compiled by Svelte's own compiler for the server as
// vite-plugin-svelte compiles it, and rendered by `svelte/server` with the suite's props: the DOM
// must be exactly the one the reference describes, with no whitespace text it does not have
// (Svelte keeps whitespace between two elements as a space, which renders as soon as CSS makes
// them inline). It must be so whatever the consumer's `preserveWhitespace`, which the
// component's own options override.
import type { Component } from "svelte";
import { compile } from "svelte/compiler";
import { afterAll, describe, expect, it } from "vitest";

import { emitParity, parityProps, paritySuites } from "../../codegen/test/render-parity-node.ts";
import {
  CARRIAGE_RETURN_CASES,
  compareCases,
  parseHtml,
} from "../../codegen/test/render-parity.ts";
import type { ParitySuite } from "../../codegen/test/render-parity.ts";
import target from "../src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { importScratch, removeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** How the component is emitted, and the consumer's own Svelte option. */
interface Setup {
  format: boolean;
  preserveWhitespace: boolean;
}

/** Compiles and server-renders the parity component, as the `ssr:svelte` project would. */
async function render(suite: ParitySuite, { format, preserveWhitespace }: Setup): Promise<string> {
  const [file] = await emitParity(target, suite, { format });
  // Svelte's warnings (accessibility, mostly, on random trees) are L3's business, not this one's.
  const { js } = compile(file!.contents, {
    filename: file!.path,
    generate: "server",
    preserveWhitespace,
  });
  const module = await importScratch<{ default: Component }>("parity.js", js.code);
  return renderToString(module.default, { props: parityProps(suite) });
}

/** The same values with every carriage return (and CRLF) turned into a line feed. */
function withLineFeeds(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value).replace(/\\r(?:\\n)?/g, "\\n"));
}

describe.each<Setup>([
  { format: true, preserveWhitespace: false },
  { format: false, preserveWhitespace: false },
  { format: true, preserveWhitespace: true },
])(
  "svelte output (formatted: $format), compiled with preserveWhitespace: $preserveWhitespace",
  (setup) => {
    it.each(paritySuites().filter(({ cases }) => cases !== CARRIAGE_RETURN_CASES))(
      "renders $title exactly as the reference describes them",
      async (suite) => {
        const html = await render(suite, setup);
        for (const { name, expected, actual } of compareCases(parseHtml(html), suite)) {
          expect.soft(actual, name).toEqual(expected);
        }
      },
    );

    // Pinned, not passed: Svelte's compiler folds static text and attributes, constant expressions
    // included, into JavaScript template literals (`$$renderer.push(`…`)`, `from_html(`…`)`),
    // which turn a carriage return into a line feed. The emitter cannot avoid that; the analyzer
    // is to report carriage returns, which no target carries through an HTML parser either (M1).
    // When this fails, Svelte keeps them: move the case back into the parity suites.
    it("turns carriage returns into line feeds, as Svelte's compiler does", async () => {
      const suite = { title: "carriage returns", cases: CARRIAGE_RETURN_CASES };
      const html = await render(suite, setup);
      for (const { name, expected, actual } of compareCases(parseHtml(html), suite)) {
        expect.soft(actual, name).toEqual(withLineFeeds(expected));
      }
    });
  },
);
