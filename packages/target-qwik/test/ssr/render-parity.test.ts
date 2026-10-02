// The Qwik output, formatted and not, compiled by Qwik's Vite plugin (the optimizer) as the
// `ssr:qwik` project compiles it and rendered by Qwik's server renderer: the DOM must be exactly
// the one the IR describes.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { emitParity, paritySuites } from "../../../codegen/test/render-parity-node.ts";
import { compareCases, parseHtml } from "../../../codegen/test/render-parity.ts";
import type { ParityCase } from "../../../codegen/test/render-parity.ts";
import target from "../../src/index.ts";
import { renderToString } from "../../src/toolchain/server.ts";

/** Under the plugin's `srcDir` (the fixtures), so the optimizer compiles what is written here. */
const scratch = fileURLToPath(new URL(`../fixtures/.uf-tmp/${randomUUID()}`, import.meta.url));
mkdirSync(scratch, { recursive: true });
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Compiles and server-renders the parity component, as the `ssr:qwik` project would. */
async function render(cases: readonly ParityCase[], format: boolean): Promise<string> {
  const [file] = await emitParity(target, cases, { format });
  const path = join(scratch, `${randomUUID()}.tsx`);
  writeFileSync(path, file!.contents);
  return renderToString(((await import(path)) as { default: unknown }).default, {});
}

/** Qwik's own bookkeeping on rendered elements (`:`, `q:key`, `q:*`). */
const qwikAttribute = (name: string) => name === ":" || name.startsWith("q:");

describe.each([true, false])("qwik output (formatted: %s), rendered by Qwik", (format) => {
  it.each(paritySuites())("renders %s exactly as the IR describes them", async (_, cases) => {
    const html = await render(cases, format);
    const rendered = parseHtml(html, { ignoreAttribute: qwikAttribute });
    for (const { name, expected, actual } of compareCases(rendered, cases)) {
      expect.soft(actual, name).toEqual(expected);
    }
  });
});
