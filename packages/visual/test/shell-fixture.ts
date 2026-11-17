// The shell's fixtures, written as the preview writes its page: the catalogue of a fixture
// project through `readCatalogue`, and frames on a stub page beside it, which answers each render
// at once, so the shell's own behaviour is tested without seven Vite servers.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type {} from "@vitest/browser-playwright";
import type { BrowserCommand } from "vitest/node";

import { readCatalogue } from "../src/preview/catalogue.ts";
import { projectConfig } from "../src/preview/index.ts";
import { PREVIEW_MESSAGE } from "../src/preview/protocol.ts";
import { shellData, shellPage } from "../src/preview/shell.ts";
import { SHELL_FIXTURES } from "./shell-commands.ts";
import type { ShellFixture } from "./shell-commands.ts";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const ROOTS: Record<ShellFixture, string> = {
  "design-system": fileURLToPath(new URL("../../../tests/e2e/design-system", import.meta.url)),
  "shell-tree": fileURLToPath(new URL("fixtures/shell-tree", import.meta.url)),
};
const TARGETS = ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"];

/** A frame that answers each render it is sent, from the shell it names, as `frame.ts` does. */
const STUB_FRAME = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Frame</title></head>
  <body>
    <main data-uf-preview-root></main>
    <script>
      const type = ${JSON.stringify(PREVIEW_MESSAGE)};
      const shell = new URL(location.href).searchParams.get("shell");
      addEventListener("message", (event) => {
        if (event.source !== parent || event.origin !== shell) return;
        if (event.data?.type !== type || event.data.kind !== "render") return;
        parent.postMessage({ type, kind: "rendered", seq: event.data.seq }, shell);
      });
      parent.postMessage({ type, kind: "ready" }, shell);
    </script>
  </body>
</html>
`;

/** `ufShellFixture`: the shell page of a fixture, which only Node can read the catalogue for. */
export const ufShellFixture: BrowserCommand<[name: ShellFixture, targets?: string[]]> = async (
  _context,
  name,
  targets = TARGETS,
) => {
  if (!SHELL_FIXTURES.includes(name)) throw new Error(`No shell fixture named ${String(name)}.`);
  const root = ROOTS[name];
  const catalogue = await readCatalogue(root, (await projectConfig(root)).srcDir);
  const out = join(PACKAGE, ".output/shell");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "frame.html"), STUB_FRAME);
  const frames = targets.map((target) => ({
    target,
    src: `/.output/shell/frame.html?target=${target}`,
  }));
  const html = shellPage(shellData(catalogue, frames));
  writeFileSync(join(out, `${name}.html`), html);
  return { html };
};

/** `ufShellColorScheme`: `prefers-color-scheme` as the page sees it, which only Playwright can set. */
export const ufShellColorScheme: BrowserCommand<[scheme: "light" | "dark"]> = async (
  context,
  scheme,
) => {
  await context.page.emulateMedia({ colorScheme: scheme });
};
