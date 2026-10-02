import { readFileSync } from "node:fs";

import { formatOutput } from "@unframework/codegen";
import type { EmitContext } from "@unframework/codegen";
import {
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
} from "@unframework/ir";
import type { ElementNode, RenderNode, UfExport } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { QWIK_ATTRIBUTE_NAMES, QWIK_BOOLEAN_ATTRIBUTES } from "../src/attributes.ts";
import target from "../src/index.ts";

const at = { start: 0, end: 0 };

function element(
  tag: string,
  attributes: Record<string, string | true> = {},
  children: RenderNode[] = [],
): ElementNode {
  const list = Object.entries(attributes).map(([name, value]) =>
    createStaticAttribute(name, value, at),
  );
  return createElement(tag, list, children, at);
}

const greeting = element("p", { class: "greeting" }, [createText("Hello, world!", at)]);

function emit(render: ElementNode, exports: UfExport[] = [createExport("default", "Hello", at)]) {
  const component = createComponent("Hello", render, at);
  const module = createModule("Hello.uf.tsx", [component], exports);
  const reported: unknown[] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  const files = target.emit(component, context);
  expect(reported).toEqual([]);
  return files;
}

/** The single file's contents, formatted as the compiler formats them. */
async function emitted(render: ElementNode, exports?: UfExport[]): Promise<string> {
  const [file, ...rest] = emit(render, exports);
  expect(rest).toEqual([]);
  const outcome = await formatOutput(file!);
  expect(outcome.error).toBeUndefined();
  return outcome.file.contents;
}

const named = (name: string): UfExport => ({ ...createExport("named", "Hello", at), name });

describe("qwik target", () => {
  it("declares every capability", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "element",
      "interactivity",
      "listbox",
      "static-attribute",
      "text",
    ]);
  });

  it("emits one TSX file per component, named after it", () => {
    expect(emit(greeting).map((file) => file.path)).toEqual(["Hello.tsx"]);
  });

  it("emits a default export as `export default component$`", async () => {
    expect(await emitted(greeting)).toBe(
      [
        `import { component$ } from "@qwik.dev/core";`,
        ``,
        `export default component$(() => {`,
        `  return <p class="greeting">Hello, world!</p>;`,
        `});`,
        ``,
      ].join("\n"),
    );
  });

  it("declares a same-named export in place", async () => {
    expect(await emitted(greeting, [named("Hello")])).toContain(
      `export const Hello = component$(() => {`,
    );
  });

  it("keeps aliases and several exports of one component in an export list", async () => {
    const contents = await emitted(greeting, [
      named("Greeting"),
      named("Hello"),
      createExport("default", "Hello", at),
    ]);
    expect(contents).toContain(`\nconst Hello = component$(() => {`);
    expect(contents).toMatch(/\nexport \{ Hello as Greeting, Hello, Hello as default \};\n$/);
  });

  it("declares a component the module does not export without exporting it", async () => {
    const contents = await emitted(greeting, []);
    expect(contents).toContain(`\nconst Hello = component$(() => {`);
    expect(contents).not.toContain("export");
  });

  it("writes the attribute names Qwik's JSX types declare on HTML elements", async () => {
    const contents = await emitted(
      element("form", { novalidate: true, class: "f" }, [
        element("label", { for: "x", accesskey: "n" }, [createText("X", at)]),
        element("input", { id: "x", readonly: true, maxlength: "3", "aria-label": "X" }),
      ]),
    );
    expect(contents).toContain(`<form noValidate class="f">`);
    expect(contents).toContain(`<label for="x" accessKey="n">`);
    expect(contents).toContain(`<input id="x" readOnly maxLength="3" aria-label="X" />`);
  });

  it("keeps SVG's case-sensitive names, and returns to HTML inside foreignObject", async () => {
    const contents = await emitted(
      element("div", { tabindex: "0" }, [
        element("svg", { viewBox: "0 0 1 1", tabindex: "0" }, [
          element("foreignObject", { width: "1" }, [element("p", { tabindex: "1" })]),
        ]),
        element("math", { tabindex: "0" }),
      ]),
    );
    expect(contents).toContain(`<div tabIndex="0">`);
    expect(contents).toContain(`<svg viewBox="0 0 1 1" tabindex="0">`);
    expect(contents).toContain(`<foreignObject width="1">`);
    expect(contents).toContain(`<p tabIndex="1" />`);
    expect(contents).toContain(`<math tabindex="0" />`);
  });

  it("writes boolean attributes bare and other valueless attributes empty", async () => {
    // Qwik's client renderer turns `true` into "true" on a non-boolean attribute.
    const contents = await emitted(
      element("details", { open: true, "data-state": true, hidden: true, title: true }),
    );
    expect(contents).toContain(`<details open data-state="" hidden title="" />`);
  });

  it("writes a boolean attribute bare whatever its value, as HTML reads it", async () => {
    // Qwik's JSX types these as `boolean`: a string fails type-checking (L4).
    const contents = await emitted(
      element("form", {}, [
        element("input", { disabled: "false", readonly: "" }),
        element("details", { open: "open" }),
        element("div", { hidden: "until-found" }),
        element("div", { hidden: "hidden" }),
      ]),
    );
    expect(contents).toContain("<input disabled readOnly />");
    expect(contents).toContain("<details open />");
    expect(contents).toContain('<div hidden="until-found" />');
    expect(contents).toContain("<div hidden />");
  });

  it("spells the attributes Qwik camel-cases on single elements", async () => {
    const contents = await emitted(
      element("form", {}, [
        element("button", { formenctype: "text/plain" }),
        element("dialog", { closedby: "any" }),
      ]),
    );
    expect(contents).toContain('<button formEnctype="text/plain" />');
    expect(contents).toContain('<dialog closedBy="any" />');
  });

  it("reads HTML attribute names case-insensitively, as HTML does", async () => {
    const contents = await emitted(element("input", { readOnly: true, TabIndex: "0" }));
    expect(contents).toContain(`<input readOnly tabIndex="0" />`);
  });

  it("keys its tables by lower-case HTML names", () => {
    for (const name of [...Object.keys(QWIK_ATTRIBUTE_NAMES), ...QWIK_BOOLEAN_ATTRIBUTES]) {
      expect(name).toBe(name.toLowerCase());
    }
  });

  it("emits exactly the attribute fixture the server renderer is tested on", async () => {
    const render = element("form", { class: "attributes", novalidate: true }, [
      element("label", { for: "note", accesskey: "n" }, [createText("Note", at)]),
      element("input", { id: "note", readonly: true, "data-state": true, autocomplete: "off" }),
      element("time", { datetime: "2026-10-01", itemprop: "date" }, [createText("Today", at)]),
      element("img", {
        src: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
        alt: "",
        crossorigin: "anonymous",
        referrerpolicy: "no-referrer",
      }),
      element("button", { type: "submit", formnovalidate: true, disabled: true }, [
        createText("Send", at),
      ]),
      element("svg", { viewBox: "0 0 1 1", "aria-hidden": "true" }, [
        element("foreignObject", { width: "1", height: "1" }, [
          element("p", { contenteditable: "true" }, [createText("Edit", at)]),
        ]),
      ]),
    ]);
    const fixture = readFileSync(new URL("fixtures/Attributes.tsx", import.meta.url), "utf8");
    expect(await emitted(render)).toBe(fixture);
  });
});
