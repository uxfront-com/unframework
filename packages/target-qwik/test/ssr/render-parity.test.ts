// The Qwik output, formatted and not, compiled by Qwik's Vite plugin (the optimizer) as the
// `ssr:qwik` project compiles it and rendered by Qwik's server renderer with the suite's props:
// the DOM must be exactly the one the reference describes.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { emitParity, parityProps, paritySuites } from "../../../codegen/test/render-parity-node.ts";
import { compareCases, parseHtml } from "../../../codegen/test/render-parity.ts";
import type { ParitySuite } from "../../../codegen/test/render-parity.ts";
import target from "../../src/index.ts";
import { renderToString } from "../../src/toolchain/server.ts";

/** Under the plugin's `srcDir` (the fixtures), so the optimizer compiles what is written here. */
const scratch = fileURLToPath(new URL(`../fixtures/.uf-tmp/${randomUUID()}`, import.meta.url));
mkdirSync(scratch, { recursive: true });
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Compiles and server-renders the parity component, as the `ssr:qwik` project would. */
async function render(suite: ParitySuite, format: boolean): Promise<string> {
  const [file] = await emitParity(target, suite, { format });
  const path = join(scratch, `${randomUUID()}.tsx`);
  writeFileSync(path, file!.contents);
  return renderToString(((await import(path)) as { default: unknown }).default, {
    props: parityProps(suite),
  });
}

/** Qwik's own bookkeeping on rendered elements (`:`, `q:key`, `q:*`). */
const qwikAttribute = (name: string) => name === ":" || name.startsWith("q:");

describe.each([true, false])("qwik output (formatted: %s), rendered by Qwik", (format) => {
  it.each(paritySuites())(
    "renders $title exactly as the reference describes them",
    async (suite) => {
      const html = await render(suite, format);
      const rendered = parseHtml(html, { ignoreAttribute: qwikAttribute });
      for (const { name, expected, actual } of compareCases(rendered, suite)) {
        expect.soft(actual, name).toEqual(expected);
      }
    },
  );
});
