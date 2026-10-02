// The Vue output, formatted and not, compiled by @vue/compiler-sfc as @vitejs/plugin-vue compiles
// it and rendered by Vue's server renderer: the DOM must be exactly the one the IR describes.
// Vue is the reference target (D10), so a space it loses here is written into every target's
// shared expectations.
import { afterAll, describe, expect, it } from "vitest";
import { compileTemplate, parse } from "vue/compiler-sfc";

import { emitParity, paritySuites } from "../../codegen/test/render-parity-node.ts";
import { compareCases, parseHtml } from "../../codegen/test/render-parity.ts";
import type { ParityCase } from "../../codegen/test/render-parity.ts";
import target from "../src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { importScratch, removeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** Compiles and server-renders the parity component, as the `ssr:vue` project would. */
async function render(cases: readonly ParityCase[], format: boolean): Promise<string> {
  const [file] = await emitParity(target, cases, { format });
  const { descriptor, errors } = parse(file!.contents, { filename: file!.path });
  expect(errors).toEqual([]);
  const compiled = compileTemplate({
    source: descriptor.template!.content,
    // plugin-vue reuses the descriptor's AST, so whitespace is condensed exactly once, there.
    ast: descriptor.template!.ast,
    filename: file!.path,
    id: "render-parity",
    ssr: true,
    ssrCssVars: [],
    transformAssetUrls: false,
  });
  expect(compiled.errors).toEqual([]);
  const { ssrRender } = await importScratch<{ ssrRender: unknown }>("parity.mjs", compiled.code);
  return renderToString({ ssrRender }, {});
}

describe.each([true, false])("vue output (formatted: %s), rendered by Vue", (format) => {
  it.each(paritySuites())("renders %s exactly as the IR describes them", async (_, cases) => {
    const html = await render(cases, format);
    for (const { name, expected, actual } of compareCases(parseHtml(html), cases)) {
      expect.soft(actual, name).toEqual(expected);
    }
  });
});
