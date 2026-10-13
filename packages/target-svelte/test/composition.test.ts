// Composition across files (ADR-0053 to ADR-0055): what the target emits for sources that import
// each other, rendered by Svelte's server and checked by svelte-check, beside Vue's rendering of
// the same sources.
import { pathToFileURL } from "node:url";

import type { Component } from "svelte";
import { compile } from "svelte/compiler";
import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { compileSources, removeScratch, toolchainDir, writeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** svelte-check takes about a second; give it room on a loaded machine. */
const checker = { timeout: 60_000 };

/** Renders a source's output on Svelte's server, its siblings compiled beside it. */
async function render(
  sources: Record<string, string>,
  main: string,
  props: Record<string, unknown> = {},
): Promise<string> {
  const outputs = await compileSources(sources);
  const modules = Object.fromEntries(
    Object.entries(outputs).map(([path, contents]) => [
      path.replace(/\.svelte$/, ".js"),
      compile(contents, { filename: path, generate: "server" }).js.code.replace(
        /(from\s+["']\.\/[^"']+)\.svelte(["'])/g,
        "$1.js$2",
      ),
    ]),
  );
  const paths = writeScratch(modules);
  const module = (await import(pathToFileURL(paths[`${main}.js`]!).href)) as {
    default: Component;
  };
  return renderToString(module.default, { props });
}

/** svelte-check's messages on every output of the sources, by file name. */
async function check(sources: Record<string, string>): Promise<Record<string, string[]>> {
  const paths = writeScratch(await compileSources(sources));
  const results = await toolchain.typecheck(Object.values(paths), {
    toolchainDir,
    root: toolchainDir,
  });
  return Object.fromEntries(
    Object.entries(paths).map(([name, path]) => [
      name,
      (results.get(path) ?? []).map(({ message }) => message),
    ]),
  );
}

const CHIP =
  "export default function Chip({ label }: { label: string }) {\n  return <i>{label}</i>;\n}\n";
const CARD =
  "export default function Card({ label }: { label: string }) {\n  return <b>{label}</b>;\n}\n";

describe("svelte composition across files", () => {
  // `<component is>` whose condition reads a list's item or a fill's parameter: a `$derived` in
  // the script cannot see them, so the component renders under the condition where it sits.
  it(
    "renders <component is> that reads a block's variable inside that block",
    checker,
    async () => {
      const list = [
        'import Card from "./Card.uf.tsx";',
        'import Chip from "./Chip.uf.tsx";',
        "",
        "export interface Item {",
        "  id: number;",
        "  label: string;",
        "  compact: boolean;",
        "}",
        "",
        "export default function List({ items }: { items: Item[] }) {",
        "  return (",
        "    <ul>",
        "      {items.map((item) => (",
        "        <li key={item.id}>",
        "          <component is={item.compact ? Chip : Card} label={item.label} />",
        "        </li>",
        "      ))}",
        "    </ul>",
        "  );",
        "}",
        "",
      ].join("\n");
      const sources = { "Card.uf.tsx": CARD, "Chip.uf.tsx": CHIP, "List.uf.tsx": list };
      const items = [
        { id: 1, label: "a", compact: true },
        { id: 2, label: "b", compact: false },
      ];
      expect(await render(sources, "List", { items })).toMatch(
        /<ul[^>]*>.*<i>a<\/i>.*<b>b<\/b>.*<\/ul>/,
      );
      expect(await check(sources)).toEqual({
        "Card.svelte": [],
        "Chip.svelte": [],
        "List.svelte": [],
      });
    },
  );

  // A fill's snippet is named like its slot, which would hide the parent's own `header` from
  // every expression between the child's tags.
  it("keeps a parent's binding named like a slot it fills", async () => {
    const card = [
      'import { defineSlots } from "unframework";',
      'import type { Element } from "unframework";',
      "",
      "export default function Card() {",
      "  const slots = defineSlots<{ header?(): Element; default?(): Element }>();",
      "  return (",
      "    <article>",
      "      {slots.header?.()}",
      "      {slots.default?.()}",
      "    </article>",
      "  );",
      "}",
      "",
    ].join("\n");
    const post = [
      'import Card from "./Card.uf.tsx";',
      "",
      "export default function Post({ header }: { header: string }) {",
      "  return <Card>{{ header: () => <h2>{header}</h2>, default: () => <p>Body {header}</p> }}</Card>;",
      "}",
      "",
    ].join("\n");
    const html = await render({ "Card.uf.tsx": card, "Post.uf.tsx": post }, "Post", {
      header: "Hello",
    });
    expect(html).toContain("<h2>Hello</h2>");
    expect(html).toContain("<p>Body Hello</p>");
  });

  // ADR-0054, ruling B: a consumer's nullish declaration removes the property at every level,
  // as Vue's `normalizeStyle` keeps the `undefined` through each merge.
  it("passes a consumer's nullish style through a component with a style of its own", async () => {
    const tag =
      'export default function Tag() {\n  return <span style={{ color: "red" }}>t</span>;\n}\n';
    const mid = [
      'import Tag from "./Tag.uf.tsx";',
      "",
      "export default function Mid() {",
      '  return <Tag style={{ color: "blue" }} />;',
      "}",
      "",
    ].join("\n");
    const page = [
      'import Mid from "./Mid.uf.tsx";',
      "",
      "export default function Page({ on }: { on: boolean }) {",
      "  return (",
      "    <div>",
      '      <Mid style={{ color: on ? "green" : undefined }} />',
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n");
    const sources = { "Mid.uf.tsx": mid, "Page.uf.tsx": page, "Tag.uf.tsx": tag };
    const off = await render(sources, "Page", { on: false });
    expect(off).not.toMatch(/color: (?:red|blue)/);
    expect(await render(sources, "Page", { on: true })).toMatch(/color: green/);
  });

  it("keeps a consumer's declaration whole where a quoted value holds a `;`", async () => {
    const tag =
      'export default function Tag() {\n  return <span style="padding: 2px">t</span>;\n}\n';
    const html = await render({ "Tag.uf.tsx": tag }, "Tag", { style: 'content: "a;b"' });
    expect(html).toContain("content: &quot;a;b&quot;");
  });

  // ADR-0054: a component that turns fallthrough off takes neither `class` nor `style`, so a
  // parent whose root it is passes none on.
  it("passes no fallthrough to a root component that takes none", checker, async () => {
    const field = [
      'import { defineOptions } from "unframework";',
      "",
      "export default function Field({ label }: { label: string }) {",
      "  defineOptions({ inheritAttrs: false });",
      '  return <label class="field">{label}</label>;',
      "}",
      "",
    ].join("\n");
    const form = [
      'import Field from "./Field.uf.tsx";',
      "",
      "export default function Form() {",
      '  return <Field label="Email" />;',
      "}",
      "",
    ].join("\n");
    expect(await check({ "Field.uf.tsx": field, "Form.uf.tsx": form })).toEqual({
      "Field.svelte": [],
      "Form.svelte": [],
    });
  });

  // A key's type may name a global (`Error`) or a type the providing module does not export: the
  // consumer imports neither, only what the providing output exports for the key.
  it("types an injected key from what its module's output exports", checker, async () => {
    const provider = [
      'import { defineSlots, provide, ref } from "unframework";',
      'import type { Element, InjectionKey, Ref } from "unframework";',
      "",
      "interface Box {",
      "  size: number;",
      "}",
      "",
      'export const BoxKey: InjectionKey<Box> = Symbol("uf.box");',
      'export const ErrorKey: InjectionKey<Ref<Error | undefined>> = Symbol("uf.error");',
      "",
      "export default function Provider() {",
      "  const slots = defineSlots<{ default?(): Element }>();",
      "  const error = ref<Error | undefined>(undefined);",
      "  provide(BoxKey, { size: 1 });",
      "  provide(ErrorKey, error);",
      "  return <div>{slots.default?.()}</div>;",
      "}",
      "",
    ].join("\n");
    const reader = [
      'import { inject, ref } from "unframework";',
      "",
      'import { BoxKey, ErrorKey } from "./Provider.uf.tsx";',
      "",
      "export default function Reader() {",
      "  const none = ref<Error | undefined>(undefined);",
      "  const box = inject(BoxKey);",
      "  const error = inject(ErrorKey, none);",
      "  return (",
      "    <p>",
      "      {box?.size} {error.value?.message}",
      "    </p>",
      "  );",
      "}",
      "",
    ].join("\n");
    expect(await check({ "Provider.uf.tsx": provider, "Reader.uf.tsx": reader })).toEqual({
      "Provider.svelte": [],
      "Reader.svelte": [],
    });
  });
});
