// Composition shapes the corpus has no case for (QA's probes on the Astro lane): slots forwarded
// in a list, `<component is>` in a list and under a condition, injection keys whose types name
// strings and globals, an inline props type whose last member ends in a comment, and scoped slots
// named with a reserved word and `style`. Each output passes Astro's compiler, `astro check` and
// the linters, and the ones that render differently when written wrong render through Astro.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { formatOutput } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import { astroTypecheck } from "../src/toolchain/check.ts";
import { astroFrameworkCompile } from "../src/toolchain/compile.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { scratchDirectory, writeAstroModule } from "./astro.ts";
import { emitSource } from "./source.ts";
import { integrationRoot, toolchainDir } from "./workspace.ts";

/** Sources whose shapes the corpus has no case for, each emitted as one directory of outputs. */
const SOURCES: Record<string, string> = {
  Frames: [
    'import { defineSlots } from "unframework";',
    'import type { Element } from "unframework";',
    "function Box() {",
    "  const slots = defineSlots<{ title?(): Element; default?(): Element }>();",
    '  return <div><h3>{slots.title?.() ?? "Untitled"}</h3>{slots.default?.()}</div>;',
    "}",
    "export default function Frames({ labels }: { labels: string[] }) {",
    "  const slots = defineSlots<{ title?(): Element }>();",
    "  return (",
    "    <ul>",
    "      {labels.map((label) => (",
    "        <Box key={label}>{{ title: slots.title, default: () => <p>{label}</p> }}</Box>",
    "      ))}",
    "    </ul>",
    "  );",
    "}",
  ].join("\n"),
  Dyn: [
    "export default function Dyn({ items, user }: { items: { label: string; strong: boolean }[]; user?: { admin: boolean } }) {",
    "  return (",
    "    <div>",
    "      <ul>",
    "        {items.map((item) => (",
    '          <li key={item.label}><component is={item.strong ? "strong" : "span"}>{item.label}</component></li>',
    "        ))}",
    "      </ul>",
    '      {user ? <component is={user.admin ? "strong" : "span"}>Admin</component> : <em>Guest</em>}',
    "    </div>",
    "  );",
    "}",
  ].join("\n"),
  Keys: [
    'import { inject, provide } from "unframework";',
    'import type { InjectionKey } from "unframework";',
    "interface Handle { Name: string; el: HTMLElement | null; e: Error }",
    'export const ModeKey: InjectionKey<"Light" | "Dark"> = Symbol("uf.mode");',
    'export const HandleKey: InjectionKey<Handle> = Symbol("uf.handle");',
    "function Reader() {",
    "  const mode = inject(ModeKey);",
    "  const handle = inject(HandleKey);",
    '  return <p>{mode ?? "none"} {handle?.Name ?? "nobody"}</p>;',
    "}",
    "export default function Provider() {",
    '  provide(ModeKey, "Dark");',
    "  return <section><Reader /></section>;",
    "}",
  ].join("\n"),
  Note: [
    "export default function Note({ label }: {",
    "  label: string // shown in the note",
    "}) {",
    "  return <p>{label}</p>;",
    "}",
  ].join("\n"),
  Slots: [
    'import { defineSlots } from "unframework";',
    'import type { Element } from "unframework";',
    "function List({ items }: { items: string[] }) {",
    "  const slots = defineSlots<{ case?(props: { item: string }): Element; style?(props: { item: string }): Element }>();",
    "  return <ul>{items.map((entry) => <li key={entry}>{slots.case?.({ item: entry })}{slots.style?.({ item: entry })}</li>)}</ul>;",
    "}",
    "export default function Page() {",
    '  return <div><List items={["a"]} style="color: red">{{ style: ({ item }) => <b>{item}</b>, case: ({ item: value }) => <i>{value}</i> }}</List></div>;',
    "}",
  ].join("\n"),
  ThemeKeys: [
    'import { inject, provide } from "unframework";',
    'import type { InjectionKey } from "unframework";',
    'type Mode = "light" | "dark";',
    "interface Theme {",
    "  mode: Mode;",
    "  size: number;",
    "}",
    'export const ThemeKey: InjectionKey<Theme> = Symbol("uf.theme");',
    "function Badge() {",
    "  const theme = inject(ThemeKey);",
    '  return <p>{theme?.mode ?? "none"}</p>;',
    "}",
    "export default function Provider() {",
    '  provide(ThemeKey, { mode: "dark", size: 1 });',
    "  return (",
    "    <div>",
    "      <Badge />",
    "    </div>",
    "  );",
    "}",
  ].join("\n"),
  Page: [
    'import { defineSlots } from "unframework";',
    'import type { Element } from "unframework";',
    "function List({ items, styleSlot }: { items: string[]; styleSlot: string }) {",
    "  const slots = defineSlots<{ style?(props: { item: string }): Element }>();",
    "  return (",
    "    <ul title={styleSlot}>",
    "      {items.map((entry) => (",
    "        <li key={entry}>{slots.style?.({ item: entry })}</li>",
    "      ))}",
    "    </ul>",
    "  );",
    "}",
    "export default function Page() {",
    "  return (",
    "    <div>",
    '      <List items={["a"]} styleSlot="S">',
    "        {{ style: ({ item }) => <b>{item}</b> }}",
    "      </List>",
    "    </div>",
    "  );",
    "}",
  ].join("\n"),
};

const scratch = scratchDirectory("composition-probes");
afterAll(() => scratch.remove());

/** A source's outputs, formatted, by file name. */
async function outputs(name: string): Promise<{ path: string; contents: string }[]> {
  return Promise.all(
    emitSource(SOURCES[name]!, `${name}.uf.tsx`).map(
      async (file) => (await formatOutput(file)).file,
    ),
  );
}

/** Renders a source's main output with its props, its children compiled beside it. */
async function render(name: string, props: Record<string, unknown>): Promise<string> {
  const directory = join(scratch.path, `render-${name}`);
  mkdirSync(directory, { recursive: true });
  let main = "";
  for (const { path, contents } of await outputs(name)) {
    const stem = path.replace(/\.astro$/, "");
    const file = writeAstroModule(directory, contents.replace(/\.astro";/g, '.mjs";'), stem);
    if (stem === name) main = file;
  }
  const module: { default: unknown } = await import(main);
  return renderToString(module.default, { props });
}

describe("composition shapes the corpus has no case for", { timeout: 60_000 }, () => {
  it("pass Astro's compiler, astro check and the linters with no finding", async () => {
    const files: { path: string; contents: string }[] = [];
    for (const name of Object.keys(SOURCES)) {
      const directory = join(scratch.path, "toolchain", name);
      mkdirSync(directory, { recursive: true });
      for (const file of await outputs(name)) {
        const path = join(directory, file.path);
        writeFileSync(path, file.contents);
        files.push({ path, contents: file.contents });
      }
    }
    const paths = files.map(({ path }) => path);
    const context = { toolchainDir, root: integrationRoot };
    const [compiledFiles, checked, linted] = await Promise.all([
      astroFrameworkCompile(files, context),
      astroTypecheck(paths, context),
      toolchain.lint(paths, context),
    ]);
    const clean = Object.fromEntries(paths.map((path) => [path, []]));
    expect(
      Object.fromEntries(
        [...compiledFiles].map(([path, { errors, warnings }]) => [path, [...errors, ...warnings]]),
      ),
    ).toEqual(clean);
    expect(Object.fromEntries(checked)).toEqual(clean);
    expect(Object.fromEntries(linted)).toEqual(clean);
  });

  it("forward a slot from a list only where it was filled, so the child shows its fallback", async () => {
    const html = await render("Frames", { labels: ["a", "b"] });
    expect(html.match(/<h3>Untitled<\/h3>/g)).toHaveLength(2);
  });

  it("declare `<component is>` where its list's item and its condition's guard hold", async () => {
    const html = await render("Dyn", { items: [{ label: "x", strong: true }] });
    expect(html).toContain("<strong>x</strong>");
    expect(html).toContain("<em>Guest</em>");
  });

  it("name a render prop apart from the child's own props, on both sides", async () => {
    const html = await render("Page", {});
    expect(html).toContain('<ul title="S">');
    expect(html).toContain("<b>a</b>");
  });
});
