// `innerHTML={markup}` (ADR-0097): an element's content as markup, which no target escapes. It
// lowers to a RawHtml attribute with a warning (UF3051), on an element that holds content and has
// no children (UF3052), from a string only.
import { checkInvariants } from "@unframework.dev/ir";
import type { RawHtmlAttribute } from "@unframework.dev/ir";
import { describe, expect, it } from "vitest";

import { applyAndRecheck, component, problems, root } from "./helpers.ts";

/** The diagnostics a component returning `jsx` gets, as `code text-at-span`. */
function reported(jsx: string, props?: string): Array<string> {
  const { source, diagnostics } = component(jsx, props === undefined ? {} : { props });
  return problems(source, diagnostics);
}

describe("raw HTML", () => {
  it.each([
    ["<div innerHTML={body} />", "body: string", "body"],
    ['<div innerHTML="<b>Hi</b>" />', undefined, '"<b>Hi</b>"'],
    ["<div innerHTML={'<i>x</i>'} />", undefined, "'<i>x</i>'"],
    ["<pre innerHTML={`<code>${body}</code>`} />", "body: string", "`<code>${body}</code>`"],
  ])("lowers %s to a RawHtml attribute, with its warning", (jsx, props, code) => {
    const { source, module, diagnostics } = component(jsx, props === undefined ? {} : { props });
    expect(problems(source, diagnostics)).toEqual([
      `UF3051 ${jsx.slice(jsx.indexOf("innerHTML"), jsx.lastIndexOf(" />"))}`,
    ]);
    expect(diagnostics[0]!.severity).toBe("warning");
    const [attribute] = root(module).attributes as [RawHtmlAttribute];
    expect(attribute.kind).toBe("RawHtml");
    expect(attribute.value.code).toBe(code);
    expect(checkInvariants(module!)).toEqual([]);
  });

  it("keeps the element's other attributes", () => {
    const { module } = component(
      '<article class="prose" title={body} innerHTML={body} id="post" />',
      { props: "body: string" },
    );
    expect(root(module).attributes.map(({ kind }) => kind)).toEqual([
      "Static",
      "Bound",
      "RawHtml",
      "Static",
    ]);
  });

  it.each([
    ["<p innerHTML={body}>a</p>", ["UF3052 innerHTML"]],
    ["<div innerHTML={body}>{body}</div>", ["UF3052 innerHTML"]],
    ["<div innerHTML={body}><span /></div>", ["UF3052 innerHTML"]],
    ["<br innerHTML={body} />", ["UF3052 innerHTML"]],
    ["<input innerHTML={body} />", ["UF3052 innerHTML"]],
    ["<textarea innerHTML={body} />", ["UF3052 innerHTML"]],
    ["<option innerHTML={body} />", ["UF3052 innerHTML"]],
  ])("rejects %s, whose element has or holds no markup content", (jsx, expected) => {
    expect(reported(jsx, "body: string")).toEqual(expected);
  });

  it("keeps whitespace children JSX drops out of it", () => {
    expect(reported("<div innerHTML={body}>\n  </div>", "body: string")).toEqual([
      "UF3051 innerHTML={body}",
    ]);
  });

  it.each([
    ["body: string | undefined", "undefined"],
    ["body: string | null", "null"],
    ["body: number", "a number"],
    ["body: boolean", "a boolean"],
  ])("rejects a value that can be other than a string (%s)", (props, kind) => {
    const { diagnostics } = component("<div innerHTML={body} />", { props });
    expect(diagnostics.map(({ code }) => code)).toEqual(["UF3018"]);
    expect(diagnostics[0]!.message).toContain(kind);
  });

  it("accepts a string the source falls back to", () => {
    expect(reported('<div innerHTML={body ?? ""} />', "body?: string")).toEqual([
      'UF3051 innerHTML={body ?? ""}',
    ]);
  });

  it.each([
    ['<div innerHTML="a &amp; b" />', 'UF1002 "a &amp; b"'],
    ['<div innerHTML="a\\nb" />', 'UF1002 "a\\nb"'],
    ["<div innerHTML />", "UF1002 innerHTML"],
    ["<div innerHTML={} />", "UF1001 {}"],
    ["<div innerHTML=<b /> />", "UF3012 <b />"],
  ])("rejects %s, whose value is no markup the targets read alike", (jsx, expected) => {
    expect(reported(jsx)).toEqual([expected]);
  });

  it("rejects it on `<component is>`, which Vue writes as a component", () => {
    expect(
      reported(
        '<component is={nested ? "h3" : "h2"} innerHTML={body} />',
        "nested: boolean; body: string",
      ),
    ).toEqual(["UF1002 innerHTML"]);
  });

  it("rejects it on an SVG element", () => {
    expect(reported("<svg><g innerHTML={body} /></svg>", "body: string")).toEqual([
      "UF1002 innerHTML",
    ]);
  });

  it("renames another case of it, and lowers it all the same", () => {
    const { source, diagnostics } = component("<div innerhtml={body} />", {
      props: "body: string",
    });
    expect(problems(source, diagnostics)).toEqual(["UF3004 innerhtml", "UF3051 innerhtml={body}"]);
    expect(applyAndRecheck(source, diagnostics)).toContain("<div innerHTML={body} />");
  });

  it("reports it set twice", () => {
    expect(reported("<div innerHTML={body} innerHTML={body} />", "body: string")).toEqual([
      "UF3051 innerHTML={body}",
      "UF3051 innerHTML={body}",
      "UF3007 innerHTML",
    ]);
  });

  it("does not render a spread's `innerHTML` key", () => {
    const { diagnostics } = component("<div {...attrs} />", {
      props: "attrs: { innerHTML: string }",
    });
    expect(diagnostics.map(({ code }) => code)).toEqual(["UF1002"]);
    expect(diagnostics[0]!.message).toContain("innerHTML={markup}");
  });

  it("points `dangerouslySetInnerHTML` at it", () => {
    const { diagnostics } = component('<div dangerouslySetInnerHTML="x" />');
    expect(diagnostics.map(({ code }) => code)).toEqual(["UF3005"]);
    expect(diagnostics[0]!.message).toContain("innerHTML={markup}");
  });
});
