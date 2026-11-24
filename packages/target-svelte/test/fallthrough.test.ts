// What falls through a component (ADR-0118): the attributes and DOM listeners it does not
// declare land on its root, or on the element that spreads its props' rest, and a ref on a child
// that exposes nothing holds its root element. Each source pair is emitted as `compile()` does,
// rendered by Svelte's server and checked by svelte-check.
import { pathToFileURL } from "node:url";

import type { Component } from "svelte";
import { compile } from "svelte/compiler";
import { afterAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import { compileSources, removeScratch, toolchainDir, writeScratch } from "./helpers.ts";

afterAll(removeScratch);

/** svelte-check takes about a second; give it room on a loaded machine. */
const checker = { timeout: 120_000 };

/** Renders a source's output on Svelte's server, its siblings compiled beside it. */
async function render(sources: Record<string, string>, main: string): Promise<string> {
  const outputs = await compileSources(sources);
  const modules = Object.fromEntries(
    Object.entries(outputs).map(([path, contents]) => [
      path.replace(/\.svelte$/, ".js"),
      compile(contents, { filename: path, generate: "server" }).js.code.replaceAll(
        /(from\s+["']\.\/[^"']+)\.svelte(["'])/g,
        "$1.js$2",
      ),
    ]),
  );
  const paths = writeScratch(modules);
  const module = (await import(pathToFileURL(paths[`${main}.js`]!).href)) as {
    default: Component;
  };
  return renderToString(module.default, { props: {} });
}

/** svelte-check's messages on every output of the sources, by file name. */
async function check(sources: Record<string, string>): Promise<Record<string, Array<string>>> {
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

/** A file of source lines. */
const file = (...lines: Array<string>) => `${lines.join("\n")}\n`;

const SAVE_BUTTON = file(
  "export default function SaveButton({",
  "  title,",
  "  size,",
  "}: {",
  "  title: string;",
  "  size?: number;",
  "  tone?: string;",
  "}) {",
  '  return <button type="button" class="button">{title}</button>;',
  "}",
);

const EDITOR = file(
  'import { ref, useTemplateRef } from "@uxfront/unframework";',
  "",
  'import SaveButton from "./SaveButton.uf.tsx";',
  "",
  "export default function Editor() {",
  "  const pressed = ref(false);",
  "  const save = useTemplateRef<HTMLButtonElement>();",
  "  return (",
  "    <div>",
  "      <SaveButton",
  "        ref={save}",
  '        title="Save"',
  "        size={2}",
  '        tone="calm"',
  '        id="save"',
  "        aria-pressed={pressed.value}",
  '        type="submit"',
  "        onClick={() => (pressed.value = !pressed.value)}",
  "      />",
  '      <button type="button" onClick={() => save.value?.focus()}>Focus</button>',
  "    </div>",
  "  );",
  "}",
);

describe("svelte fallthrough", () => {
  it("types the root's attributes but the declared names, and spreads the rest last", async () => {
    const outputs = await compileSources({
      "SaveButton.uf.tsx": SAVE_BUTTON,
      "Editor.uf.tsx": EDITOR,
    });
    const child = outputs["SaveButton.svelte"]!;
    expect(child).toContain(
      '  HTMLButtonAttributes,\n    "title" | "size" | "tone" | "children" | "class" | "style" | "ref"\n  > & {',
    );
    // A declared prop nothing reads is bound apart from the rest, so it never falls through, and
    // so is one the source's pattern leaves out, which has no binding.
    expect(child).toContain("size: _size,");
    expect(child).toContain("tone: _tone,");
    expect(child).toContain("ref = $bindable(null),");
    expect(child).toMatch(
      /class=\{\["button", className\]\}\s+\{style\}\s+bind:this=\{ref\}\s+\{\.\.\.attributes\}\s*>/,
    );
    // The parent writes what falls through as the child's element would take it, and binds the
    // child's `ref` prop to a `$state` ref, which it writes after the first render.
    const parent = outputs["Editor.svelte"]!;
    expect(parent).toContain("let save = $state<HTMLButtonElement | null>(null);");
    expect(parent).toContain("bind:ref={save}");
    expect(parent).toContain('id="save"');
    expect(parent).toContain("aria-pressed={pressed}");
    expect(parent).toContain("onclick={() => (pressed = !pressed)}");
  });

  it("renders the consumer's attribute over the root's own, and no declared prop", async () => {
    const html = await render(
      { "SaveButton.uf.tsx": SAVE_BUTTON, "Editor.uf.tsx": EDITOR },
      "Editor",
    );
    expect(html).toContain('id="save"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('type="submit"');
    expect(html).not.toContain('type="button" class="button"');
    expect(html).not.toContain("title=");
    expect(html).not.toContain("size=");
    expect(html).not.toContain("tone=");
  });

  it("type-checks a parent passing attributes, listeners and a ref", checker, async () => {
    expect(await check({ "SaveButton.uf.tsx": SAVE_BUTTON, "Editor.uf.tsx": EDITOR })).toEqual({
      "Editor.svelte": [],
      "SaveButton.svelte": [],
    });
  });

  it("calls the consumer's listener after the root's own, but for an event it declares", async () => {
    const chip = file(
      'import { defineEmits } from "@uxfront/unframework";',
      "",
      "export default function Chip({ label }: { label: string }) {",
      "  const emit = defineEmits<{ pick: [label: string] }>();",
      "  function focused(event: FocusEvent) {",
      "    console.log(event.type);",
      "  }",
      "  return (",
      '    <button type="button" onClick={() => emit("pick", label)} onFocus={focused} onKeydownCapture={() => {}}>',
      "      {label}",
      "    </button>",
      "  );",
      "}",
    );
    const outputs = await compileSources({ "Chip.uf.tsx": chip });
    const output = outputs["Chip.svelte"]!;
    expect(output).toContain("onclick,\n    onfocus,\n    ...attributes");
    expect(output).toContain(
      ["onclick={(event) => {", "    onpick?.(label);", "    onclick?.(event);", "  }}"].join("\n"),
    );
    expect(output).toContain(
      ["onfocus={(event) => {", "    focused(event);", "    onfocus?.(event);", "  }}"].join("\n"),
    );
    // A capture listener is another attribute, which the spread leaves alone.
    expect(output).toContain("onkeydowncapture={() => {}}");

    // An event the component declares is its own: a consumer's `onClick` is that event.
    const clicker = file(
      'import { defineEmits } from "@uxfront/unframework";',
      "",
      "export default function Clicker({ label }: { label: string }) {",
      "  const emit = defineEmits<{ click: [label: string] }>();",
      '  return <button type="button" onClick={() => emit("click", label)}>{label}</button>;',
      "}",
    );
    const own = (await compileSources({ "Clicker.uf.tsx": clicker }))["Clicker.svelte"]!;
    expect(own).toContain(
      '  HTMLButtonAttributes,\n    "label" | "onclick" | "children" | "class" | "style" | "ref"\n  > & {',
    );
    expect(own).toContain("onclick={() => onclick?.(label)}");
  });

  it("spreads the props' rest on its element, the scope attributes on the root", async () => {
    const field = file(
      'import { defineOptions } from "@uxfront/unframework";',
      "",
      "export default function Field({ label, ...rest }: { label: string }) {",
      "  defineOptions({ inheritAttrs: false });",
      "  return (",
      '    <label class="field">',
      '      {label} <input {...rest} type="text" class="input" />',
      "    </label>",
      "  );",
      "}",
    );
    const output = (await compileSources({ "Field.uf.tsx": field }))["Field.svelte"]!;
    expect(output).toContain(
      'type Props = Omit<HTMLInputAttributes, "label" | "children" | "class" | "style" | "ref"> & {',
    );
    expect(output).toContain('ref?: HTMLElementTagNameMap["label"] | null;');
    expect(output).toContain("bind:this={ref}");
    expect(output).toContain("{...scopeAttributes(rest)}");
    expect(output).toMatch(
      /<input\s+type="text"\s+class=\{\["input", className\]\}\s+\{style\}\s+\{\.\.\.restAttributes\(rest\)\}/,
    );
    expect(output).toContain("function restAttributes(props: object): Record<string, unknown> {");
  });

  it("sets the root's own ref and the `ref` prop through one function binding", async () => {
    const field = file(
      'import { onMounted, useTemplateRef } from "@uxfront/unframework";',
      "",
      "export default function NameField({ label }: { label: string }) {",
      "  const input = useTemplateRef<HTMLInputElement>();",
      "  onMounted(() => input.value?.focus());",
      "  return <input ref={input} aria-label={label} />;",
      "}",
    );
    const output = (await compileSources({ "NameField.uf.tsx": field }))["NameField.svelte"]!;
    expect(output).toContain(
      [
        "bind:this={() => input, (element) => {",
        "    input = element;",
        "    ref = element;",
        "  }}",
      ].join("\n"),
    );
  });

  it("binds `bind:this` on a child that exposes, and `ref` on an <svg> root", async () => {
    const exposing = file(
      'import { defineExpose } from "@uxfront/unframework";',
      "",
      "export default function Counter() {",
      "  function reset() {}",
      "  defineExpose({ reset });",
      "  return <p>0</p>;",
      "}",
    );
    const icon = file(
      "export default function Icon({ title }: { title: string }) {",
      '  return <svg viewBox="0 0 1 1"><title>{title}</title></svg>;',
      "}",
    );
    const parent = file(
      'import { useTemplateRef } from "@uxfront/unframework";',
      "",
      'import Counter from "./Counter.uf.tsx";',
      'import Icon from "./Icon.uf.tsx";',
      "",
      "export default function Panel() {",
      "  const counter = useTemplateRef<{ reset(): void }>();",
      "  const icon = useTemplateRef<SVGSVGElement>();",
      "  return (",
      "    <div>",
      "      <Counter ref={counter} />",
      '      <Icon ref={icon} title="Star" />',
      "    </div>",
      "  );",
      "}",
    );
    const outputs = await compileSources({
      "Counter.uf.tsx": exposing,
      "Icon.uf.tsx": icon,
      "Panel.uf.tsx": parent,
    });
    expect(outputs["Counter.svelte"]).not.toContain("$bindable");
    expect(outputs["Icon.svelte"]).toContain(
      'Omit<SvelteHTMLElements["svg"], "title" | "children" | "class" | "style" | "ref">',
    );
    expect(outputs["Icon.svelte"]).toContain('ref?: SVGElementTagNameMap["svg"] | null;');
    expect(outputs["Panel.svelte"]).toContain("<Counter bind:this={counter} />");
    expect(outputs["Panel.svelte"]).toContain('<Icon bind:ref={icon} title="Star" />');
  });

  it("passes a ref through a root component, which binds its child's `ref`", async () => {
    const base = file(
      "export default function Base({ text }: { text: string }) {",
      '  return <button type="button">{text}</button>;',
      "}",
    );
    const primary = file(
      'import Base from "./Base.uf.tsx";',
      "",
      "export default function Primary({ text }: { text: string }) {",
      '  return <Base text={text} class="primary" />;',
      "}",
    );
    const outputs = await compileSources({ "Base.uf.tsx": base, "Primary.uf.tsx": primary });
    expect(outputs["Primary.svelte"]).toContain(
      'type Props = Omit<HTMLButtonAttributes, "text" | "children" | "class" | "style" | "ref"> & {',
    );
    expect(outputs["Primary.svelte"]).toContain(
      '<Base {text} class={["primary", className]} {style} bind:ref {...attributes} />',
    );
  });

  // The rest a component passes its root component holds none of the names that component
  // declares: a `<section>`'s `title` and `children` would meet the root's own `title` prop and
  // the content between its tags.
  it(
    "types the rest passed to a root component without the names it declares",
    checker,
    async () => {
      const panel = file(
        'import { defineSlots } from "@uxfront/unframework";',
        "",
        "export default function Panel({ title }: { title: string }) {",
        "  const slots = defineSlots<{ default?(): unknown }>();",
        "  return <section aria-label={title}>{slots.default?.()}</section>;",
        "}",
      );
      const greeting = file(
        'import Panel from "./Panel.uf.tsx";',
        "",
        "export default function Greeting({ name }: { name: string }) {",
        '  return <Panel title="Welcome"><p>Hello, {name}!</p></Panel>;',
        "}",
      );
      const sources = { "Panel.uf.tsx": panel, "Greeting.uf.tsx": greeting };
      expect((await compileSources(sources))["Greeting.svelte"]).toContain(
        '"name" | "children" | "class" | "style" | "ref" | "title"',
      );
      expect(await check(sources)).toEqual({ "Greeting.svelte": [], "Panel.svelte": [] });
    },
  );
});
