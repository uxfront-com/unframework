// Composition across files (ADR-0053 to ADR-0055): what the target emits for sources that import
// each other, rendered by Svelte's server and checked by svelte-check. Each expectation is what
// Vue renders for the same sources.
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

/** A component that exposes one function and renders its label in a tag. */
const exposing = (name: string, tag: string): string =>
  [
    'import { defineExpose } from "unframework";',
    "",
    `export default function ${name}({ label }: { label: string }) {`,
    "  function bump() {}",
    "  defineExpose({ bump });",
    `  return <${tag}>{label}</${tag}>;`,
    "}",
    "",
  ].join("\n");

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
        /<ul[^>]*>.*<i(?: class="")?>a<\/i>.*<b(?: class="")?>b<\/b>.*<\/ul>/,
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
    // A comment's apostrophe opens no string, and an escaped `;` ends no declaration.
    const commented = await render({ "Tag.uf.tsx": tag }, "Tag", {
      style: "color: blue /* don't */; padding: 0",
    });
    expect(commented).not.toContain("padding: 2px");
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
  // consumer imports neither, only the key, whose type carries its value's.
  it("types an injected key from the key it imports", checker, async () => {
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
  // A key whose value type is named `<Key>Value`, a name an output could have given it.
  it("types a key whose value type the module declares as `<Key>Value`", checker, async () => {
    const provider = [
      'import { defineSlots, provide } from "unframework";',
      'import type { Element, InjectionKey } from "unframework";',
      "",
      "export interface ThemeValue {",
      "  tone: string;",
      "}",
      "",
      'export const Theme: InjectionKey<ThemeValue> = Symbol("uf.theme");',
      "",
      "export default function Provider() {",
      "  const slots = defineSlots<{ default?(): Element }>();",
      '  provide(Theme, { tone: "warm" });',
      "  return <div>{slots.default?.()}</div>;",
      "}",
      "",
    ].join("\n");
    const reader = [
      'import { inject } from "unframework";',
      "",
      'import { Theme } from "./Provider.uf.tsx";',
      "",
      "export default function Reader() {",
      "  const theme = inject(Theme);",
      "  return <p>{theme?.tone}</p>;",
      "}",
      "",
    ].join("\n");
    expect(await check({ "Provider.uf.tsx": provider, "Reader.uf.tsx": reader })).toEqual({
      "Provider.svelte": [],
      "Reader.svelte": [],
    });
  });

  // The consumer imports only the key, so no type or component the module declares under the
  // name an output could have given the key's value type (`<Key>Value`) clashes with it.
  it("types a key beside another type named `<Key>Value`", checker, async () => {
    const provider = [
      'import { defineSlots, provide, ref } from "unframework";',
      'import type { Element, InjectionKey, Ref } from "unframework";',
      "",
      "export interface ThemeValue {",
      "  tone: string;",
      "}",
      "",
      'export const Theme: InjectionKey<Ref<ThemeValue>> = Symbol("uf.theme");',
      "",
      "export default function Provider() {",
      "  const slots = defineSlots<{ default?(): Element }>();",
      '  const theme = ref<ThemeValue>({ tone: "warm" });',
      "  provide(Theme, theme);",
      "  return <div>{slots.default?.()}</div>;",
      "}",
      "",
    ].join("\n");
    const reader = [
      'import { inject, ref } from "unframework";',
      "",
      'import { Theme } from "./Provider.uf.tsx";',
      "",
      "export default function Reader() {",
      '  const none = ref({ tone: "none" });',
      "  const theme = inject(Theme, none);",
      "  return <p>{theme.value.tone}</p>;",
      "}",
      "",
    ].join("\n");
    expect(await check({ "Provider.uf.tsx": provider, "Reader.uf.tsx": reader })).toEqual({
      "Provider.svelte": [],
      "Reader.svelte": [],
    });
  });

  it("types a key beside a component named `<Key>Value`", checker, async () => {
    const provider = [
      'import { defineSlots, provide } from "unframework";',
      'import type { Element, InjectionKey } from "unframework";',
      "",
      'import ThemeValue from "./ThemeValue.uf.tsx";',
      "",
      'export const Theme: InjectionKey<string> = Symbol("uf.theme");',
      "",
      "export default function Provider() {",
      "  const slots = defineSlots<{ default?(): Element }>();",
      '  provide(Theme, "dark");',
      "  return (",
      "    <div>",
      "      <ThemeValue />",
      "      {slots.default?.()}",
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n");
    const themeValue = "export default function ThemeValue() {\n  return <hr />;\n}\n";
    const reader = [
      'import { inject } from "unframework";',
      "",
      'import { Theme } from "./Provider.uf.tsx";',
      "",
      "export default function Reader() {",
      "  const theme = inject(Theme);",
      "  return <p>{theme}</p>;",
      "}",
      "",
    ].join("\n");
    expect(
      await check({
        "Provider.uf.tsx": provider,
        "ThemeValue.uf.tsx": themeValue,
        "Reader.uf.tsx": reader,
      }),
    ).toEqual({ "Provider.svelte": [], "ThemeValue.svelte": [], "Reader.svelte": [] });
  });

  // A key imported under two names is imported under both, as the source writes it.
  it("injects a key imported under two names", checker, async () => {
    const provider = [
      'import { defineSlots, provide } from "unframework";',
      'import type { Element, InjectionKey } from "unframework";',
      "",
      'export const Theme: InjectionKey<string> = Symbol("uf.theme");',
      "",
      "export default function Provider() {",
      "  const slots = defineSlots<{ default?(): Element }>();",
      '  provide(Theme, "dark");',
      "  return <div>{slots.default?.()}</div>;",
      "}",
      "",
    ].join("\n");
    const reader = [
      'import { inject } from "unframework";',
      "",
      'import { Theme, Theme as Mode } from "./Provider.uf.tsx";',
      "",
      "export default function Reader() {",
      '  const theme = inject(Theme, "light");',
      "  const mode = inject(Mode);",
      "  return (",
      "    <p>",
      "      {theme} {mode}",
      "    </p>",
      "  );",
      "}",
      "",
    ].join("\n");
    const outputs = await compileSources({ "Provider.uf.tsx": provider, "Reader.uf.tsx": reader });
    expect(outputs["Reader.svelte"]).toContain(
      'import { Theme, Theme as Mode } from "./Provider.svelte";',
    );
    expect(await check({ "Provider.uf.tsx": provider, "Reader.uf.tsx": reader })).toEqual({
      "Provider.svelte": [],
      "Reader.svelte": [],
    });
  });

  // An exposed function keeps its name in the component's API, and a fill's parameter is
  // written as the source writes it: a snippet named like either must not hide it.
  it("keeps an exposed function and a fill's parameter named like a slot they fill", async () => {
    const card = [
      'import { defineSlots } from "unframework";',
      'import type { Element } from "unframework";',
      "",
      "export default function Card() {",
      "  const slots = defineSlots<{",
      "    header?(): Element;",
      "    default?(): Element;",
      "    footer?(props: { n: number }): Element;",
      "  }>();",
      "  return (",
      "    <article>",
      "      {slots.header?.()}",
      "      {slots.default?.()}",
      "      {slots.footer?.({ n: 1 })}",
      "    </article>",
      "  );",
      "}",
      "",
    ].join("\n");
    const table = [
      'import { defineSlots } from "unframework";',
      'import type { Element } from "unframework";',
      "",
      "export default function Table({ rows }: { rows: string[] }) {",
      "  const slots = defineSlots<{ row?(props: { header: string }): Element }>();",
      "  return (",
      "    <div>",
      "      {rows.map((header) => (",
      "        <section key={header}>{slots.row?.({ header })}</section>",
      "      ))}",
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n");
    const page = [
      'import { defineExpose } from "unframework";',
      "",
      'import Card from "./Card.uf.tsx";',
      'import Table from "./Table.uf.tsx";',
      "",
      "export default function Page() {",
      "  function footer() {",
      '    return "F";',
      "  }",
      "  defineExpose({ footer });",
      "  return (",
      "    <main>",
      "      <Card>{{ default: () => <p>{footer()}</p>, footer: ({ n }) => <small>{n}</small> }}</Card>",
      '      <Table rows={["x"]}>',
      "        {{",
      "          row: ({ header }) => (",
      "            <Card>{{ header: () => <h3>{header}</h3>, default: () => <p>{header}</p> }}</Card>",
      "          ),",
      "        }}",
      "      </Table>",
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n");
    const html = await render(
      { "Card.uf.tsx": card, "Page.uf.tsx": page, "Table.uf.tsx": table },
      "Page",
    );
    const outputs = await compileSources({
      "Card.uf.tsx": card,
      "Page.uf.tsx": page,
      "Table.uf.tsx": table,
    });
    // The exposed function keeps its name in the component's exports.
    expect(outputs["Page.svelte"]).toContain("export const footer = footer_1;");
    const { warnings } = compile(outputs["Page.svelte"]!, {
      filename: "Page.svelte",
      generate: "client",
    });
    expect(warnings.map(({ code }) => code)).toEqual([]);
    expect(html).toContain("<p>F</p>");
    expect(html).toContain("<small>1</small>");
    expect(html).toContain("<h3>x</h3>");
    expect(html).toContain("<p>x</p>");
  });

  // A template ref on `<component is>` chosen where it sits changes after the first render,
  // which Svelte wants declared with `$state` (`non_reactive_update`).
  it("declares a ref on a <component is> chosen in a block with $state", async () => {
    const rows = [
      'import { defineSlots } from "unframework";',
      'import type { Element } from "unframework";',
      "",
      "export default function Rows({ rows }: { rows: string[] }) {",
      "  const slots = defineSlots<{ row?(props: { row: string; index: number }): Element }>();",
      "  return (",
      "    <ul>",
      "      {rows.map((row, index) => (",
      "        <li key={row}>{slots.row?.({ row, index })}</li>",
      "      ))}",
      "    </ul>",
      "  );",
      "}",
      "",
    ].join("\n");
    const list = [
      'import { useTemplateRef } from "unframework";',
      "",
      'import Card from "./Card.uf.tsx";',
      'import Chip from "./Chip.uf.tsx";',
      'import Rows from "./Rows.uf.tsx";',
      "",
      "export default function List({ rows }: { rows: string[] }) {",
      "  const last = useTemplateRef<{ bump(): void }>();",
      "  return (",
      "    <div>",
      "      <Rows rows={rows}>",
      "        {{",
      "          row: ({ row, index }) => (",
      "            <component is={index > 0 ? Card : Chip} ref={last} label={row} />",
      "          ),",
      "        }}",
      "      </Rows>",
      '      <button type="button" onClick={() => last.value?.bump()}>',
      "        Bump",
      "      </button>",
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n");
    const outputs = await compileSources({
      "Card.uf.tsx": exposing("Card", "b"),
      "Chip.uf.tsx": exposing("Chip", "i"),
      "List.uf.tsx": list,
      "Rows.uf.tsx": rows,
    });
    const { warnings } = compile(outputs["List.svelte"]!, {
      filename: "List.svelte",
      generate: "client",
    });
    expect(warnings.map(({ code }) => code)).toEqual([]);
  });
});
