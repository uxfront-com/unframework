import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component, problems, root, run } from "./helpers.ts";

/** The diagnostics of a component that returns `jsx`, with the text under each. */
function found(jsx: string, props?: string): string[] {
  const { source, diagnostics } = component(jsx, props ? { props } : {});
  return problems(source, diagnostics);
}

describe("SVG", () => {
  it("lowers an icon with SVG's own case, attributes and text", () => {
    const { module, diagnostics } = component(
      '<svg viewBox="0 0 24 24" width={size} class="icon" role="img" aria-label={label}><title>{label}</title><defs><linearGradient id="g" x1="0"><stop offset="0" stop-color={colour} /></linearGradient></defs><path d="M0 0" stroke-width="2" fill="url(#g)" /><text x="1">{label} <tspan>x</tspan></text></svg>',
      { props: "size: number; label: string; colour: string" },
    );
    expect(diagnostics).toEqual([]);
    const svg = root(module);
    expect(svg.tag).toBe("svg");
    expect(
      svg.attributes.map((attribute) =>
        attribute.kind === "Static" || attribute.kind === "Bound" ? attribute.name : attribute.kind,
      ),
    ).toEqual(["viewBox", "width", "class", "role", "aria-label"]);
    expect(svg.children.map((child) => child.kind === "Element" && child.tag)).toEqual([
      "title",
      "defs",
      "path",
      "text",
    ]);
  });

  it.each([
    ["<svg><div /></svg>", "UF3001 div"],
    ["<svg><lineargradient /></svg>", "UF3001 lineargradient"],
    ["<svg><circel /></svg>", "UF3001 circel"],
    ["<svg><font-face /></svg>", "UF3001 font-face"],
    ["<svg><script /></svg>", "UF3002 script"],
    ["<svg><style /></svg>", "UF3002 style"],
    ["<svg><animate /></svg>", "UF3002 animate"],
    ['<svg><a href="/">x</a></svg>', "UF1002 a"],
    ["<div><circle /></div>", "UF3001 circle"],
    ["<div><linearGradient /></div>", "UF3001 linearGradient"],
    ["<g />", "UF1002 g"],
  ])("reports %s", (jsx, problem) => {
    expect(found(jsx)).toEqual([problem]);
  });

  it("reports a <foreignObject> once, and nothing inside it", () => {
    expect(found("<svg><foreignObject><div><p><div /></p></div></foreignObject></svg>")).toEqual([
      "UF1002 foreignObject",
    ]);
  });

  it("fixes an SVG element's case", () => {
    const { source, diagnostics } = component("<svg><lineargradient></lineargradient></svg>");
    expect(applyAndRecheck(source, diagnostics)).toContain("<linearGradient></linearGradient>");
  });

  it("reports an element inside an SVG <title> or <desc>, which the parser reads as HTML", () => {
    expect(found("<svg><title><tspan>x</tspan></title></svg>")).toEqual(["UF3003 tspan"]);
  });

  it.each([
    ['<svg viewbox="0 0 1 1" />', "viewbox", "viewBox"],
    ['<svg><path strokeWidth="2" /></svg>', "strokeWidth", "stroke-width"],
    ['<svg className="x" />', "className", "class"],
    ['<svg><use xlinkHref="#a" /></svg>', "xlinkHref", "href"],
    ['<svg><use xlink:href="#a" /></svg>', "xlink:href", "href"],
    ['<svg ariaLabel="x" />', "ariaLabel", "aria-label"],
  ])("renames the SVG attribute in %s", (jsx, written, name) => {
    const { source, diagnostics } = component(jsx);
    expect(problems(source, diagnostics)).toEqual([`UF3004 ${written}`]);
    expect(applyAndRecheck(source, diagnostics)).toContain(` ${name}=`);
  });

  it("offers no rename to an href already set", () => {
    const { diagnostics } = component('<svg><use xlink:href="#b" href="#a" /></svg>');
    expect(codes(diagnostics)).toEqual(["UF3004", "UF3007"]);
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });

  it.each([
    ['<svg xmlns="http://www.w3.org/2000/svg" />', "UF3005 xmlns"],
    ['<svg xmlns:xlink="http://www.w3.org/1999/xlink" />', "UF3005 xmlns:xlink"],
    ['<svg><text xml:lang="en">a</text></svg>', "UF3005 xml:lang"],
    ['<svg><circle href="#a" /></svg>', "UF3006 href"],
    ['<svg><circle data-fooBar="x" /></svg>', "UF3004 data-fooBar"],
    ['<svg><path d="M0 0" fill /></svg>', "UF3004 fill"],
    ['<svg><use href="javascript:x" /></svg>', "UF3008 href"],
  ])("reports %s", (jsx, problem) => {
    expect(found(jsx)).toEqual([problem]);
  });

  // They are not rendered, and Vue types `<title>` with HTML's attributes.
  it.each([
    ['<svg><title fill="red">a</title></svg>', "UF3006 fill"],
    ['<svg><desc transform="scale(2)">a</desc></svg>', "UF3006 transform"],
    ['<svg><title role="img">a</title></svg>', "UF3006 role"],
    ['<svg><desc tabindex="0">a</desc></svg>', "UF3006 tabindex"],
  ])("takes only the core attributes on <title> and <desc>: %s", (jsx, problem) => {
    expect(found(jsx)).toEqual([problem]);
  });

  it("accepts the core, ARIA and data attributes on <title> and <desc>", () => {
    const { diagnostics } = component(
      '<svg><title id="t" class="c" lang="en" style="color: red" aria-hidden="true" data-x="1">a</title><desc id="d">b</desc></svg>',
    );
    expect(diagnostics).toEqual([]);
  });

  // dom-expressions leaves `title` out of its SVG tags, so Solid creates a branch's or a list's
  // own <title> in HTML's namespace.
  it.each([
    ["<svg>{on && <title>a</title>}</svg>", ["UF1002 title"]],
    ["<svg>{on ? <title>a</title> : <title>b</title>}</svg>", ["UF1002 title", "UF1002 title"]],
    ["<svg>{on && <><title>a</title><g /></>}</svg>", ["UF1002 title"]],
    ["<svg>{items.map((item) => <title key={item}>{item}</title>)}</svg>", ["UF1002 title"]],
  ])("reports an SVG <title> that starts a branch or a list's element, in %s", (jsx, found) => {
    const { source, diagnostics } = component(jsx, { props: "on: boolean; items: string[]" });
    expect(problems(source, diagnostics)).toEqual(found);
    expect(diagnostics[0]!.message).toContain("Solid creates it in HTML's namespace");
  });

  it("accepts an SVG <title> inside a branch's element, and a conditional inside a <title>", () => {
    for (const jsx of [
      "<svg>{on && <g><title>a</title></g>}</svg>",
      '<svg><title>{on ? "a" : "b"}</title></svg>',
    ]) {
      expect(component(jsx, { props: "on: boolean" }).diagnostics, jsx).toEqual([]);
    }
  });

  it.each([
    ["<svg>{label}</svg>", "UF3003 {label}"],
    ["<svg><g>{label}</g></svg>", "UF3003 {label}"],
    ['<svg><g>{on && "x"}</g></svg>', 'UF3003 on && "x"'],
  ])("reports text an expression renders outside SVG's text elements in %s", (jsx, problem) => {
    expect(found(jsx, "label: string; on: boolean")).toEqual([problem]);
  });

  it("removes the whitespace Svelte drops outside a <text>, and keeps it inside one", () => {
    const { source, diagnostics } = component('<svg> <g> <circle r="1" /> </g></svg>');
    expect(codes(diagnostics)).toEqual(["UF3003", "UF3003", "UF3003"]);
    expect(applyAndRecheck(source, diagnostics)).toContain('<svg><g><circle r="1" /></g></svg>');
    expect(component("<svg><text>a <tspan>b</tspan> c</text></svg>").diagnostics).toEqual([]);
  });

  // A space between two values in a <title> or a <desc> is part of an accessible name: Svelte
  // drops it, and removing it would change the name, so the help writes one expression.
  it("reports whitespace between values in an SVG <title>, without a fix that removes it", () => {
    const { source, diagnostics } = component(
      '<svg viewBox="0 0 1 1" role="img"><title>{label} {status}</title></svg>',
      { props: "label: string; status: string" },
    );
    expect(problems(source, diagnostics)).toEqual(["UF3003  "]);
    expect(diagnostics[0]!.fixes).toBeUndefined();
    expect(diagnostics[0]!.help).toContain("one expression");
    expect(
      component('<svg viewBox="0 0 1 1" role="img"><title>{`${label} ${status}`}</title></svg>', {
        props: "label: string; status: string",
      }).diagnostics,
    ).toEqual([]);
  });

  it("keeps static text in any SVG element, as every target does", () => {
    expect(component("<svg><g>label</g></svg>").diagnostics).toEqual([]);
  });

  it("lowers nested <svg> and lists inside SVG", () => {
    const { diagnostics } = run(
      'export function A({ points }: { points: { x: number }[] }) { return <svg><svg>{points.map((point, i) => <circle key={i} cx={point.x} r="1" />)}</svg></svg>; }',
    );
    expect(diagnostics).toEqual([]);
  });
});
