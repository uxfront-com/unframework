// Scoped styles on Qwik, compiled by the optimizer and rendered by Qwik's server renderer as the
// `ssr:qwik` project renders them (ADR-0063): the sheet `useStyles$` attaches, and the child-root
// rule through a root component.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { scopeStylesheet } from "@unframework/codegen";
import type { ModuleApi } from "@unframework/ir";
import { afterAll, describe, expect, it } from "vitest";

import { renderToString } from "../../src/toolchain/server.ts";
import { BUTTON, lowered, output } from "../styles.ts";

/** Under the plugin's `srcDir` (the fixtures), so the optimizer compiles what is written here. */
const scratch = fileURLToPath(new URL(`../fixtures/.uf-tmp/${randomUUID()}`, import.meta.url));
mkdirSync(scratch, { recursive: true });
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/**
 * Writes each source's output beside the others, with the sheet `compile()` scopes and emits
 * beside it, and loads the last one's component.
 */
async function load(...sources: [file: string, source: string, sheet?: string][]) {
  const apis: Record<string, ModuleApi> = {};
  let path = "";
  for (const [file, source, sheet] of sources) {
    const css = file.replace(/\.uf\.tsx$/, ".css");
    const { module, api } = lowered(file, source, sheet ? { [`./${css}`]: sheet } : {}, apis);
    apis[`./${file}`] = { ...api, file };
    const { name, scopeId } = module.components[0]!;
    if (sheet)
      writeFileSync(join(scratch, `${file}.css`), scopeStylesheet(css, sheet, scopeId!).code);
    path = join(scratch, `${name}.tsx`);
    writeFileSync(path, await output(module));
  }
  return ((await import(path)) as { default: unknown }).default;
}

describe("qwik scoped styles, rendered by Qwik", () => {
  it("attaches the sheet, and passes the scope attributes through a root component", async () => {
    const Toolbar = await load(
      ["Button.uf.tsx", BUTTON],
      [
        "Save.uf.tsx",
        `import Button from "./Button.uf.tsx";
export default function Save() {
  return <Button text="Save" />;
}`,
      ],
      [
        "Toolbar.uf.tsx",
        `import "./Toolbar.css";
import Save from "./Save.uf.tsx";
export default function Toolbar() {
  return <div class="toolbar"><Save /></div>;
}`,
        ".button { color: red; }\n",
      ],
    );
    const html = await renderToString(Toolbar, {});
    const id = /data-uf-([0-9a-f]{8})/.exec(html)![1]!;
    // `useStyles$` writes its sheet where the component renders. Vitest's node projects load
    // CSS as an empty string (`css.include`), so its text is the browser projects' to prove.
    expect(html).toMatch(/^<style q:style="[^"]+" :><\/style><div class="toolbar" /);
    expect(html).toMatch(new RegExp(`<button [^>]*data-uf-${id}=""[^>]*>Save</button>`));
  });

  it("passes the scope attributes alone, never another prop the output leaves unread", async () => {
    const Button = await load(["Button.uf.tsx", BUTTON]);
    const html = await renderToString(Button, {
      props: { text: "Save", title: "unread", "data-uf-0a1b2c3d": "" },
    });
    expect(html).toMatch(/<button [^>]*data-uf-0a1b2c3d=""[^>]*>Save<\/button>/);
    expect(html).not.toMatch(/\btitle=/);
  });
});
