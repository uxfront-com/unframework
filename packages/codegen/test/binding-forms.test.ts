// The binding forms ADR-0065 lowers, as the targets ask about them: which a template uses, a
// spread's `style` key read on its own, and whether a style bound to a value is merged.
import { analyze } from "@unframework/analyzer";
import type { UfComponent } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { bindingForms, mergesWholeStyle, spreadStyleExpression } from "../src/index.ts";

/** The last component of a source, lowered by the analyser. */
function lowered(source: string): UfComponent {
  const { module, diagnostics } = analyze(parseModule("Fixture.uf.tsx", source));
  expect(diagnostics).toEqual([]);
  return module!.components.at(-1)!;
}

const TYPES = `type Look = { color?: string };
interface Attrs { id: string; style?: string }
`;
const PROPS =
  "{ look, tags, attrs, on }: { look?: Look; tags: string[]; attrs?: Attrs; on: boolean }";

/** A component that renders `jsx` in a `<div>`. */
const component = (jsx: string) =>
  lowered(`${TYPES}export default function A(${PROPS}) { return <div>${jsx}</div>; }`);

describe("bindingForms", () => {
  it("finds a style bound to a value, a spread's style key and a class collection", () => {
    expect(bindingForms(component('<p style={look}>a</p><i class={["a", on && "b"]} />'))).toEqual({
      wholeStyle: true,
      classCollection: false,
    });
    expect(bindingForms(component("<p {...attrs}>a</p>"))).toEqual({
      wholeStyle: true,
      classCollection: false,
    });
    expect(
      bindingForms(component('<p class={["a", tags]} style={{ color: "red" }}>a</p>')),
    ).toEqual({ wholeStyle: false, classCollection: true });
  });
});

describe("spreadStyleExpression", () => {
  it("reads the key through the spread's own `?.`, with the source's references", () => {
    const { render } = lowered(
      `${TYPES}export default function A(${PROPS}) { return <p {...(on ? attrs : undefined)}>a</p>; }`,
    );
    const spread = render.kind === "Element" ? render.attributes[0] : undefined;
    if (spread?.kind !== "Spread") throw new Error("The element has no spread first.");
    const read = spreadStyleExpression(spread);
    expect(read.code).toBe("(on ? attrs : undefined)?.style");
    // Each reference still spans its name in the code.
    for (const ref of read.refs) {
      const at = ref.span.start - read.span.start;
      expect(read.code.slice(at, at + (ref.span.end - ref.span.start))).toMatch(
        /^(on|attrs|undefined)$/,
      );
    }
  });
});

describe("mergesWholeStyle", () => {
  it("is set where a root that takes a consumer's style, or a component, has a whole style", () => {
    const child = "function B() { return <i />; }\n";
    const source = (body: string) =>
      lowered(`${TYPES}${child}export default function A(${PROPS}) { return ${body}; }`);
    expect(mergesWholeStyle(source("<p style={look}>a</p>"))).toBe(true);
    expect(mergesWholeStyle(source("<div><p style={look}>a</p></div>"))).toBe(false);
    expect(mergesWholeStyle(source("<div><B style={look} /></div>"))).toBe(true);
    expect(mergesWholeStyle(source("<p {...attrs}>a</p>"))).toBe(true);
    expect(mergesWholeStyle(source("<div><component is={on ? B : B} style={look} /></div>"))).toBe(
      true,
    );
  });
});
