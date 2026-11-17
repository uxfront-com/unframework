// The Solid output, formatted and not, compiled by babel-preset-solid for the server as
// vite-plugin-solid compiles it (`ssr: true`) and rendered by Solid's server renderer with the
// suite's props: the DOM must be exactly the one the reference describes. dom-expressions collapses raw whitespace in JSX
// text into one space, so this is where a raw tab or Unicode space would show.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { transformSync } from "@babel/core";
import { afterAll, describe, expect, it } from "vitest";

import { emitParity, parityProps, paritySuites } from "../../codegen/test/render-parity-node.ts";
import { compareCases, parseHtml } from "../../codegen/test/render-parity.ts";
import type { ParitySuite } from "../../codegen/test/render-parity.ts";
import target from "../src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { packageDir } from "./fixtures.ts";

const require = createRequire(import.meta.url);
const scratch = join(packageDir, ".uf-tmp", `render-parity-${randomUUID()}`);
mkdirSync(scratch, { recursive: true });
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Compiles and server-renders the parity component, as the `ssr:solid` project would. */
async function render(suite: ParitySuite, format: boolean): Promise<string> {
  const [file] = await emitParity(target, suite, { format });
  const { code } = transformSync(file!.contents, {
    filename: join(scratch, file!.path),
    babelrc: false,
    configFile: false,
    presets: [
      [require.resolve("babel-preset-solid"), { generate: "ssr", hydratable: true }],
      [require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true }],
    ],
  })!;
  const path = join(scratch, `${randomUUID()}.js`);
  writeFileSync(path, code!);
  return renderToString(((await import(path)) as { default: unknown }).default, {
    props: parityProps(suite),
  });
}

describe.each([true, false])("solid output (formatted: %s), rendered by Solid", (format) => {
  it.each(paritySuites())(
    "renders $title exactly as the reference describes them",
    async (suite) => {
      const html = await render(suite, format);
      const rendered = parseHtml(html, { ignoreAttribute: (name) => name === "data-hk" });
      for (const { name, expected, actual } of compareCases(rendered, suite)) {
        expect.soft(actual, name).toEqual(expected);
      }
    },
  );
});
