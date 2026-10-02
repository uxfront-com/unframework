// The Astro output, compiled by Astro's own compiler with Astro's defaults (`compressHTML:
// "jsx"`) and rendered by the Container API: the DOM must be exactly the one the IR describes.
import { afterAll, describe, expect, it } from "vitest";

import { emitParity, paritySuites } from "../../codegen/test/render-parity-node.ts";
import { compareCases, parseHtml } from "../../codegen/test/render-parity.ts";
import type { ParityCase } from "../../codegen/test/render-parity.ts";
import target from "../src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { loadAstroComponent, scratchDirectory } from "./astro.ts";

const scratch = scratchDirectory("render-parity");
afterAll(() => scratch.remove());

/** Compiles and server-renders the parity component, as the `ssr:astro` project would. */
async function render(cases: readonly ParityCase[], format: boolean): Promise<string> {
  const [file] = await emitParity(target, cases, { format });
  return renderToString(await loadAstroComponent(scratch.path, file!.contents), {});
}

describe.each([true, false])("astro output (formatted: %s), rendered by Astro", (format) => {
  it.each(paritySuites())("renders %s exactly as the IR describes them", async (_, cases) => {
    const html = await render(cases, format);
    for (const { name, expected, actual } of compareCases(parseHtml(html), cases)) {
      expect.soft(actual, name).toEqual(expected);
    }
  });
});
