// The Astro output, compiled by Astro's own compiler with Astro's defaults (`compressHTML:
// "jsx"`) and rendered by the Container API with the suite's props: the DOM must be exactly the
// one the reference describes.
import { afterAll, describe, expect, it } from "vitest";

import { emitParity, parityProps, paritySuites } from "../../codegen/test/render-parity-node.ts";
import { compareCases, parseHtml } from "../../codegen/test/render-parity.ts";
import type { ParitySuite } from "../../codegen/test/render-parity.ts";
import target from "../src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { loadAstroComponent, scratchDirectory } from "./astro.ts";

const scratch = scratchDirectory("render-parity");
afterAll(() => scratch.remove());

/** Compiles and server-renders the parity component, as the `ssr:astro` project would. */
async function render(suite: ParitySuite, format: boolean): Promise<string> {
  const [file] = await emitParity(target, suite, { format });
  return renderToString(await loadAstroComponent(scratch.path, file!.contents), {
    props: parityProps(suite),
  });
}

describe.each([true, false])("astro output (formatted: %s), rendered by Astro", (format) => {
  it.each(paritySuites())(
    "renders $title exactly as the reference describes them",
    async (suite) => {
      const html = await render(suite, format);
      for (const { name, expected, actual } of compareCases(parseHtml(html), suite)) {
        expect.soft(actual, name).toEqual(expected);
      }
    },
  );
});
