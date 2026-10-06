// The Angular output, formatted and not, compiled by ngtsc (the `ssr:angular` project's plugin)
// and rendered by Angular's server platform with the suite's props as inputs: the DOM inside the
// host element must be exactly the one the reference describes, whatever Angular's whitespace
// removal, entity decoding and interpolation would otherwise make of the template.
// Angular's own packages ship partially compiled; in this plain-Node project the JIT compiler
// finishes them as they load (the ssr project links them instead). The component under test is
// compiled ahead of time by ngtsc either way, so the template's semantics are the same.
// oxlint-disable-next-line import/no-unassigned-import -- loaded for its side effect
import "@angular/compiler";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { format as formatMessage } from "node:util";

import { afterAll, describe, expect, it, vi } from "vitest";

import { emitParity, parityProps, paritySuites } from "../../codegen/test/render-parity-node.ts";
import { compareCases, parseHtml } from "../../codegen/test/render-parity.ts";
import type { DomNode, ParitySuite } from "../../codegen/test/render-parity.ts";
import target from "../src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { ngtscPlugin, removeScratch, scratchDir } from "./helpers.ts";

afterAll(removeScratch);

/**
 * Compiles and server-renders the parity component, and returns what its host element holds,
 * with what Angular logged meanwhile: its sanitizer warns about the URLs it rewrites, and its
 * error handler logs the errors (NG0904) it renders without the value.
 */
async function render(
  suite: ParitySuite,
  format: boolean,
): Promise<{ rendered: DomNode[]; logged: string[] }> {
  const [file] = await emitParity(target, suite, { format });
  const directory = scratchDir();
  const { transform } = await ngtscPlugin();
  const { code } = await transform(join(directory, "RenderParity.uf.tsx.ts"), file!.contents);
  const compiled = join(directory, "render-parity.js");
  writeFileSync(compiled, code);
  const component = ((await import(pathToFileURL(compiled).href)) as { default: unknown }).default;
  const logged: string[] = [];
  const capture = (...args: unknown[]) => void logged.push(formatMessage(...args));
  const spies = [
    vi.spyOn(console, "error").mockImplementation(capture),
    vi.spyOn(console, "warn").mockImplementation(capture),
  ];
  let html: string;
  try {
    html = await renderToString(component, { props: parityProps(suite) });
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  const [host, ...rest] = parseHtml(html);
  expect(rest).toEqual([]);
  expect(host).toMatchObject({ tag: "uf-render-parity" });
  return { rendered: typeof host === "object" ? host.children : [], logged };
}

describe.each([true, false])("angular output (formatted: %s), rendered by Angular", (format) => {
  it.each(paritySuites())(
    "renders $title exactly as the reference describes them",
    async (suite) => {
      const { rendered, logged } = await render(suite, format);
      expect(logged).toEqual([]);
      for (const { name, expected, actual } of compareCases(rendered, suite)) {
        expect.soft(actual, name).toEqual(expected);
      }
    },
  );
});
