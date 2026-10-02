// The React output, formatted and not, transformed as Vite transforms TSX (oxc, which is also
// @vitejs/plugin-react's JSX transform) and rendered by React's server renderer: the DOM must be
// exactly the one the IR describes, and React must not warn about it.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format as formatMessage } from "node:util";

import { afterAll, describe, expect, it, vi } from "vitest";

import { emitParity, paritySuites } from "../../codegen/test/render-parity-node.ts";
import { compareCases, parseHtml } from "../../codegen/test/render-parity.ts";
import type { ParityCase } from "../../codegen/test/render-parity.ts";
import target from "../src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { packageDir } from "./fixtures.ts";

const scratch = join(packageDir, ".uf-tmp", `render-parity-${randomUUID()}`);
mkdirSync(scratch, { recursive: true });
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Imports and server-renders the parity component, with what React logged meanwhile. */
async function render(cases: readonly ParityCase[], format: boolean) {
  const [file] = await emitParity(target, cases, { format });
  const path = join(scratch, `${randomUUID()}.tsx`);
  writeFileSync(path, file!.contents);
  const component = ((await import(path)) as { default: unknown }).default;
  const logged: string[] = [];
  const capture = (...args: unknown[]) => void logged.push(formatMessage(...args));
  const spies = [
    vi.spyOn(console, "error").mockImplementation(capture),
    vi.spyOn(console, "warn").mockImplementation(capture),
  ];
  try {
    return { html: await renderToString(component, {}), logged };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

describe.each([true, false])("react output (formatted: %s), rendered by React", (format) => {
  it.each(paritySuites())("renders %s exactly as the IR describes them", async (_, cases) => {
    const { html, logged } = await render(cases, format);
    expect(logged).toEqual([]);
    for (const { name, expected, actual } of compareCases(parseHtml(html), cases)) {
      expect.soft(actual, name).toEqual(expected);
    }
  });
});
