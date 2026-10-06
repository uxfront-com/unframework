// The SVG titles the target writes as one string for Qwik's types (ADR-0040), compiled by Qwik's
// Vite plugin and rendered by its server renderer: each title holds the text the IR describes,
// conditionals, nullish values and numbers included.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { renderToString } from "../../src/toolchain/server.ts";
import { emitSource } from "../lower.ts";
import { TITLE_RENDERS, TITLES } from "../titles.ts";

/** Under the plugin's `srcDir` (the fixtures), so the optimizer compiles what is written here. */
const scratch = fileURLToPath(new URL(`../fixtures/.uf-tmp/${randomUUID()}`, import.meta.url));
mkdirSync(scratch, { recursive: true });
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const ENTITIES: Readonly<Record<string, string>> = { "&lt;": "<", "&gt;": ">", "&amp;": "&" };

/** The text of each `<title>` in server HTML, in order. */
function titles(html: string): string[] {
  return [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/g)].map(([, inner]) =>
    inner!
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/&(?:lt|gt|amp);/g, (entity) => ENTITIES[entity]!),
  );
}

describe("SVG titles, rendered by Qwik", () => {
  it.each(TITLE_RENDERS)(
    "renders each title's text with $props",
    async ({ props, titles: texts }) => {
      const path = join(scratch, `${randomUUID()}.tsx`);
      writeFileSync(path, await emitSource(TITLES));
      const module: { default: unknown } = await import(path);
      expect(titles(await renderToString(module.default, { props }))).toEqual(texts);
    },
  );
});
