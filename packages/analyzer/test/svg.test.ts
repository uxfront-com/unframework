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
