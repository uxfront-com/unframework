import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "node:util";

import { formatOutput } from "@unframework/codegen";
import type { ElementNode } from "@unframework/ir";
import { createElement } from "react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import target from "../src/index.ts";
import { AVATAR, el, emit, hello, packageDir, profileCard } from "./fixtures.ts";

async function formatted(render: ElementNode, options?: Parameters<typeof emit>[1]) {
  const { files, reported } = emit(render, options);
  expect(reported).toEqual([]);
  expect(files).toHaveLength(1);
  const outcome = await formatOutput(files[0]!);
  expect(outcome.error).toBeUndefined();
  return outcome.file;
}

describe("react target", () => {
  it("declares every capability", () => {
    expect(Object.keys(target.capabilities).toSorted()).toEqual([
      "element",
      "interactivity",
      "listbox",
      "static-attribute",
      "text",
    ]);
  });

  it("emits basics/hello as its golden output", async () => {
    expect(await formatted(hello(), { name: "Hello" })).toEqual({
      path: "Hello.tsx",
      contents: [
        "export default function Hello() {",
        '  return <p className="greeting">Hello, world!</p>;',
        "}",
        "",
      ].join("\n"),
    });
  });

  it("emits basics/nested-and-void as its golden output", async () => {
    expect(await formatted(profileCard(), { name: "ProfileCard" })).toEqual({
      path: "ProfileCard.tsx",
      contents: [
        "export default function ProfileCard() {",
        "  return (",
        '    <article className="profile" aria-labelledby="profile-name">',
        '      <header className="profile-header">',
        "        <img",
        `          src="${AVATAR}"`,
        `          alt="Ada's avatar"`,
        '          width="48"',
        '          height="48"',
        "        />",
        '        <h2 id="profile-name">Ada Lovelace</h2>',
        "      </header>",
        "      <p>",
        "        Mathematician &amp; writer",
        "        <br />",
        "        of the first published program",
        "      </p>",
        "      <hr />",
        '      <label htmlFor="profile-note">Note</label>',
        '      <input id="profile-note" type="text" name="note" placeholder="Say hello" />',
        "    </article>",
        "  );",
        "}",
        "",
      ].join("\n"),
    });
  });

  it("keeps a named export named", async () => {
    const file = await formatted(hello(), { name: "Hello", kind: "named" });
    expect(file.contents).toMatch(/^export function Hello\(\) \{/);
  });
});

/** Renders a component element on the server, collecting React's console errors. */
function renderMarkup(element: Parameters<typeof renderToStaticMarkup>[0]) {
  const errors: string[] = [];
  const spy = vi
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => void errors.push(format(...args)));
  try {
    return { html: renderToStaticMarkup(element), errors };
  } finally {
    spy.mockRestore();
  }
}

describe("react output, rendered by React", () => {
  const scratch = join(packageDir, ".uf-tmp", `emit-${randomUUID()}`);
  beforeAll(() => mkdirSync(scratch, { recursive: true }));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  /**
   * Emits the tree, formats it as the compiler does, imports it as Vite compiles TSX, and
   * renders it with React.
   */
  async function renderOutput(tree: ElementNode) {
    const { files, reported } = emit(tree);
    const outcome = await formatOutput(files[0]!);
    expect(outcome.error).toBeUndefined();
    const file = join(scratch, `${randomUUID()}.tsx`);
    writeFileSync(file, outcome.file.contents);
    const module = (await import(file)) as { default: ComponentType };
    return { ...renderMarkup(createElement(module.default)), reported };
  }

  it("is checked by a console capture that sees React's warnings", () => {
    // The controls the tests below rely on: React warns about the HTML spelling, and it
    // drops a boolean attribute whose value is the empty string.
    expect(renderMarkup(createElement("label", { for: "x" } as object)).errors).toEqual([
      expect.stringContaining("Invalid DOM property `for`. Did you mean `htmlFor`?"),
    ]);
    expect(renderMarkup(createElement("input", { disabled: "" } as object)).html).toBe("<input/>");
  });

  it("renders basics/nested-and-void as the source's HTML, without warnings", async () => {
    expect(await renderOutput(profileCard())).toEqual({
      html: [
        '<article class="profile" aria-labelledby="profile-name">',
        '<header class="profile-header">',
        `<img src="${AVATAR.replaceAll("'", "&#x27;")}" alt="Ada&#x27;s avatar" width="48" height="48"/>`,
        '<h2 id="profile-name">Ada Lovelace</h2>',
        "</header>",
        "<p>Mathematician &amp; writer<br/>of the first published program</p>",
        "<hr/>",
        '<label for="profile-note">Note</label>',
        // React's server renderer writes an input's `name` last.
        '<input id="profile-note" type="text" placeholder="Say hello" name="note"/>',
        "</article>",
      ].join(""),
      errors: [],
      reported: [],
    });
  });

  it("renders text and attribute values exactly as the IR holds them", async () => {
    const tricky = [
      "{braces} <angles> & ampersands",
      "two  spaces, a\u00a0no-break space and ‘quotes’",
      " leading and trailing ",
    ];
    const tree = el(
      "div",
      { title: 'say "hi" & {wave}', "data-path": "a\\b<c>" },
      el("p", {}, tricky[0]!),
      el("p", {}, tricky[1]!),
      el("p", {}, "before", el("b", {}, tricky[2]!), "after"),
    );
    const { html, errors, reported } = await renderOutput(tree);
    expect({ errors, reported }).toEqual({ errors: [], reported: [] });
    expect(html).toBe(
      [
        '<div title="say &quot;hi&quot; &amp; {wave}" data-path="a\\b&lt;c&gt;">',
        "<p>{braces} &lt;angles&gt; &amp; ampersands</p>",
        "<p>two  spaces, a\u00a0no-break space and ‘quotes’</p>",
        "<p>before<b> leading and trailing </b>after</p>",
        "</div>",
      ].join(""),
    );
  });

  it("renders a boolean attribute whatever its static value, as HTML does", async () => {
    const tree = el(
      "fieldset",
      {},
      el("input", { disabled: "" }),
      el("input", { disabled: "disabled" }),
      el("input", { readonly: true }),
      el("input", { required: "false" }),
      el("details", { open: "" }, el("summary", {}, "More")),
      el("div", { inert: "", hidden: "" }),
    );
    expect(await renderOutput(tree)).toEqual({
      html: [
        "<fieldset>",
        '<input disabled=""/>',
        '<input disabled=""/>',
        '<input readOnly=""/>',
        '<input required=""/>',
        '<details open=""><summary>More</summary></details>',
        '<div inert="" hidden=""></div>',
        "</fieldset>",
      ].join(""),
      errors: [],
      reported: [],
    });
  });

  it("sets a form control's initial state without making it controlled", async () => {
    const tree = el(
      "form",
      {},
      el("input", { value: "Ada" }),
      el("input", { type: "checkbox", checked: true }),
      el("textarea", { value: "Hello" }),
      el(
        "select",
        { value: "b" },
        el("option", { value: "a" }, "A"),
        el("option", { value: "b" }, "B"),
      ),
    );
    expect(await renderOutput(tree)).toEqual({
      html: [
        "<form>",
        '<input value="Ada"/>',
        '<input type="checkbox" checked=""/>',
        "<textarea>Hello</textarea>",
        '<select><option value="a">A</option><option value="b" selected="">B</option></select>',
        "</form>",
      ].join(""),
      errors: [],
      reported: [],
    });
  });

  // React's client ignores a `defaultValue` on a submit or reset input, though its server
  // renderer writes one, so a fixed value stays `value`, which React neither controls nor warns
  // about. test/render-parity.browser.test.ts renders it with `createRoot`.
  it("keeps the value of an input whose type React leaves alone", async () => {
    const tree = el(
      "form",
      {},
      el("input", { type: "submit", value: "Send" }),
      el("input", { type: "reset", value: "Clear" }),
      el("input", { type: "email", value: "ada@example.com" }),
    );
    const { files } = emit(tree);
    expect(files[0]!.contents).toContain('<input type="submit" value="Send" />');
    expect(files[0]!.contents).toContain('<input type="reset" value="Clear" />');
    expect(files[0]!.contents).toContain('<input type="email" defaultValue="ada@example.com" />');
    expect(await renderOutput(tree)).toEqual({
      html: [
        "<form>",
        '<input type="submit" value="Send"/>',
        '<input type="reset" value="Clear"/>',
        '<input type="email" value="ada@example.com"/>',
        "</form>",
      ].join(""),
      errors: [],
      reported: [],
    });
  });

  it("sets a textarea's content as its defaultValue, which React asks for instead", async () => {
    const tree = el("form", {}, el("textarea", { id: "t" }, "  Hello,\n  world  "));
    const { files } = emit(tree);
    expect(files[0]!.contents).toContain(
      '<textarea id="t" defaultValue={"  Hello,\\n  world  "} />',
    );
    expect(await renderOutput(tree)).toEqual({
      html: '<form><textarea id="t">  Hello,\n  world  </textarea></form>',
      errors: [],
      reported: [],
    });
  });

  it("reports textarea content that defaultValue cannot carry", async () => {
    const element = el("b", {}, "bold");
    const value = el("textarea", { value: "A" }, "B");
    const { html, errors, reported } = await renderOutput(
      el("form", {}, el("textarea", {}, "a", element), value),
    );
    expect(reported).toEqual([
      expect.objectContaining({ code: "UF1002", span: element.span }),
      expect.objectContaining({ code: "UF1002", span: value.attributes[0]!.span }),
    ]);
    expect({ html, errors }).toEqual({
      html: "<form><textarea></textarea><textarea>A</textarea></form>",
      errors: [],
    });
  });

  it("spells HTML and SVG attributes the way React expects", async () => {
    const tree = el(
      "div",
      { tabindex: "0", accesskey: "d", contenteditable: "", spellcheck: "false" },
      el("label", { for: "name" }, "Name"),
      el("video", { disablepictureinpicture: true, playsinline: true, crossorigin: "anonymous" }),
      el(
        "svg",
        { viewBox: "0 0 10 10", "aria-hidden": "true" },
        el("path", { d: "M0 0h10", "stroke-width": "2", "fill-rule": "evenodd" }),
      ),
    );
    const { html, errors, reported } = await renderOutput(tree);
    expect({ errors, reported }).toEqual({ errors: [], reported: [] });
    // React's server renderer keeps some React spellings (`accessKey`); HTML attribute names
    // are case-insensitive, and in the DOM React sets them through setAttribute.
    expect(html).toBe(
      [
        '<div tabindex="0" accessKey="d" contentEditable="" spellCheck="false">',
        '<label for="name">Name</label>',
        '<video disablePictureInPicture="" playsInline="" crossorigin="anonymous"></video>',
        '<svg viewBox="0 0 10 10" aria-hidden="true">',
        '<path d="M0 0h10" stroke-width="2" fill-rule="evenodd"></path>',
        "</svg>",
        "</div>",
      ].join(""),
    );
  });

  it("reports what React cannot render as the HTML would, and leaves it out", async () => {
    const style = el("p", { style: "color: red" }, "Red");
    const handler = el("button", { type: "button", onclick: "go()" }, "Go");
    const selected = el("option", { value: "b", selected: true }, "B");
    const untilFound = el("div", { hidden: "until-found" }, "Found");
    const tree = el(
      "div",
      {},
      style,
      handler,
      el("select", {}, el("option", { value: "a" }, "A"), selected),
      untilFound,
    );
    const { html, errors, reported } = await renderOutput(tree);
    expect(reported).toEqual(
      [style, handler, selected, untilFound].map((element) => ({
        code: "UF1002",
        severity: "error",
        message: expect.stringMatching(/React/),
        span: element.attributes.find((attribute) =>
          /^(style|onclick|selected|hidden)$/.test(attribute.name),
        )!.span,
      })),
    );
    expect(errors).toEqual([]);
    expect(html).toBe(
      [
        "<div>",
        "<p>Red</p>",
        '<button type="button">Go</button>',
        '<select><option value="a">A</option><option value="b">B</option></select>',
        "<div>Found</div>",
        "</div>",
      ].join(""),
    );
  });
});
