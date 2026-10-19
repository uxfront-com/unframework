// Composition's forms the corpus does not reach (src/composition.ts, src/models.ts), each as the
// emitter writes it, and rendered by Solid's server where the HTML is the point. test/output.test.ts
// runs the same sources through L3, L4 and L5.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { transformSync } from "@babel/core";
import type { Component } from "solid-js";
import { createComponent, renderToStringAsync } from "solid-js/web";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { emitSource, packageDir } from "./fixtures.ts";
import { SOURCES } from "./sources.ts";

const require = createRequire(import.meta.url);
let scratch: string;

beforeAll(() => {
  mkdirSync(join(packageDir, ".uf-tmp"), { recursive: true });
  // In the package, so the output's `solid-js` imports resolve from its node_modules.
  scratch = mkdtempSync(join(packageDir, ".uf-tmp", "composition-"));
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A source's output, compiled for Solid's server and rendered with `props` as they are. */
async function serverHtml(name: string, props: Record<string, unknown>): Promise<string> {
  const { code } = transformSync(await emitSource(SOURCES[name]!), {
    filename: join(scratch, `${name}.tsx`),
    babelrc: false,
    configFile: false,
    presets: [
      [require.resolve("babel-preset-solid"), { generate: "ssr", hydratable: true }],
      [require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true }],
    ],
  })!;
  const path = join(scratch, `${name}.js`);
  writeFileSync(path, code!);
  const { default: component } = (await import(path)) as {
    default: Component<Record<string, unknown>>;
  };
  const html = await renderToStringAsync(() => createComponent(component, props));
  return html.replace(/<!--[^>]*-->/g, "").replace(/ data-hk="[^"]*"/g, "");
}

describe("solid slots", () => {
  it("resolves a slot it tests once, in a condition or an attribute", async () => {
    const output = await emitSource(SOURCES.TestedSlots!);
    expect(output).toContain("const title = children(() => props.title);");
    expect(output).toContain("const content = children(() => props.children);");
    expect(output).toContain('data-filled={content() ? "yes" : "no"}');
    expect(output).toContain("<Show when={title()}>");
    // A slot's prop creates its content each time it is read: each is read once.
    const reads = { title: 0, children: 0 };
    const html = await serverHtml("TestedSlots", {
      get title() {
        reads.title += 1;
        return "Title";
      },
      get children() {
        reads.children += 1;
        return "Body";
      },
    });
    expect(html).toBe('<section data-filled="yes" style=""><h2>Title</h2>Body</section>');
    expect(reads).toEqual({ title: 1, children: 1 });
  });
});

describe("solid models", () => {
  it("reads a required model from its prop alone, typed as declared", async () => {
    const output = await emitSource(SOURCES.RequiredModel!);
    expect(output).toContain("  text: string;\n");
    expect(output).toContain("const text = () => props.text;");
    expect(output).toContain(
      "function setText(next: string) {\n    props.onTextChange?.(next);\n  }",
    );
    expect(output).not.toContain("createSignal");
  });

  it("shows a text model that may be nullish as no text", async () => {
    const output = await emitSource(SOURCES.NullableFields!);
    expect(output).toContain('value={name() ?? ""}');
    expect(output).toContain('value={untrack(note) ?? ""}');
    expect(output).toContain('const next = value() ?? "";');
    expect(await serverHtml("NullableFields", {})).toBe(
      '<form style=""><input aria-label="Name" value=""><input aria-label="Note" value=""><textarea aria-label="Memo">Buy milk</textarea></form>',
    );
  });

  it("shows a modified <textarea>'s nullish model as no text, once", async () => {
    const output = await emitSource(SOURCES.NullableArea!);
    expect(output).toContain('value={isServer ? undefined : (untrack(note) ?? "")}');
    expect(output).not.toContain('?? "" ?? ""');
  });

  it("writes a <textarea>'s text on the server, a modifier's too", async () => {
    const output = await emitSource(SOURCES.NullableFields!);
    expect(output).toContain("children={isServer ? memo() : undefined}");
    expect(output).toContain("ref={modelText(memo, setMemo, { trim: true })}");
  });

  it("selects a <select>'s options in a conditional and by their text", async () => {
    const output = await emitSource(SOURCES.ConditionalOptions!);
    expect(output).toContain('<option value="l" selected={size() === "l"}>');
    expect(output).toContain('<option selected={fruit() === "pear"}>pear</option>');
    const html = await serverHtml("ConditionalOptions", { extra: true });
    expect(html).toContain('<option value="l" selected>L</option>');
    expect(html).toContain("<option selected>pear</option>");
    expect(html).not.toContain("<select value");
  });
});

describe("solid refs", () => {
  it("prints one ref callback for a template ref and a modified v-model on one element", async () => {
    const output = await emitSource(SOURCES.TemplateRefModel!);
    expect(output.match(/\bref=/g)).toHaveLength(1);
    expect(output).toContain("modelText(name, setName, { trim: true })(element);");
    expect(output).toContain("box = element;");
  });

  it("prints one ref callback for a template ref and a <select>'s option selection", async () => {
    const output = await emitSource(SOURCES.RefSelect!);
    expect(output.match(/\bref=/g)).toHaveLength(1);
    expect(output).toContain("selectOptions(element, size);");
    expect(output).toContain("field = element;");
  });

  it("prints one ref callback for a template ref and a <select>'s marked options", async () => {
    const output = await emitSource(SOURCES.RefMarkedSelect!);
    expect(output.match(/\bref=/g)).toHaveLength(1);
    expect(output).toContain('<option value="s" selected={size() === "s"}>');
    expect(output).toContain("selectOptions(element, size);");
    expect(output).toContain("field = element;");
  });
});

describe("solid fallthrough", () => {
  it("merges what falls through with a root spread's class", async () => {
    const output = await emitSource(SOURCES.SpreadRoot!);
    expect(output).toContain("class={cx(props.attrs.class, props.class)}");
    expect(output.match(/\bclass=/g)).toHaveLength(1);
    expect(await serverHtml("SpreadRoot", { attrs: { class: "a", title: "t" }, class: "b" })).toBe(
      '<div class="a b" title="t" style="">x</div>',
    );
  });
});
