import type { Attribute } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component, problems, root } from "./helpers.ts";

const PROPS = [
  "label: string",
  "count: number",
  "on: boolean",
  "maybe?: string",
  'tone: "info" | "warn"',
  "items: string[]",
  "user: { name: string }",
  "attrs: { id?: string; title: string }",
  "linkAttrs?: { href: string; class?: string }",
  "classAttrs: { class: string; rel?: string }",
].join("; ");

/** The attributes of the element a component returns, with the diagnostics. */
function attributes(jsx: string, props = PROPS) {
  const result = component(jsx, { props });
  return { ...result, found: problems(result.source, result.diagnostics) };
}

/** The lowered attributes, in a compact form. */
function lowered(jsx: string, props = PROPS): string[] {
  const { module, diagnostics } = component(jsx, { props });
  expect(diagnostics).toEqual([]);
  return root(module).attributes.map(describeAttribute);
}

function describeAttribute(attribute: Attribute): string {
  switch (attribute.kind) {
    case "Static":
      return `${attribute.name}=${JSON.stringify(attribute.value)}`;
    case "Bound":
      return `${attribute.name}={${attribute.value.code}}`;
    case "Class":
      return `class[${attribute.items
        .map((item) =>
          item.kind === "Static"
            ? JSON.stringify(item.value)
            : item.kind === "Toggle"
              ? `${item.name}?${item.condition.code}`
              : `{${item.value.code}}`,
        )
        .join(", ")}]`;
    case "Style":
      return `style[${attribute.declarations
        .map((declaration) =>
          declaration.kind === "Static"
            ? `${declaration.property}: ${declaration.value}`
            : `${declaration.property}: {${declaration.value.code}}`,
        )
        .join("; ")}]`;
    case "Spread":
      return `...{${attribute.value.code}}[${attribute.keys.map((key) => key.name).join(" ")}]`;
  }
}

describe("bound attributes", () => {
  it("lowers bindings of every kind of attribute", () => {
    expect(
      lowered(
        '<button type="button" title={label} disabled={on} aria-pressed={on} data-count={count} tabindex={count}>a</button>',
      ),
    ).toEqual([
      'type="button"',
      "title={label}",
      "disabled={on}",
      "aria-pressed={on}",
      "data-count={count}",
      "tabindex={count}",
    ]);
  });

  it.each([
    ["<p title={count}>a</p>", "count", "The authoring types declare `title` as a string"],
    ["<p title={on}>a</p>", "on", "The authoring types declare `title` as a string"],
    ["<p data-x={on}>a</p>", "on", "Qwik drops `false`"],
    ["<p data-x={user}>a</p>", "user", "can be an object"],
    ["<p tabindex={label}>a</p>", "label", "React and Qwik type `tabindex` as a number"],
    ['<input type="text" disabled={label} />', "label", "`disabled` is on or off"],
    ["<p aria-label={user}>a</p>", "user", "`aria-label` renders its value as text"],
    ["<p draggable={items}>a</p>", "items", "`draggable` renders its value as text"],
  ])("reports %s (UF3018) at the value", (jsx, at, message) => {
    const { found, diagnostics } = attributes(jsx);
    expect(found).toEqual([`UF3018 ${at}`]);
    expect(diagnostics[0]!.message).toContain(message);
  });

  it.each([
    ["<details open={on}><summary>a</summary></details>", true],
    ["<p aria-hidden={on}>a</p>", true],
    ["<p data-x={label}>a</p>", true],
    ["<p data-x={count}>a</p>", true],
    ["<p title={maybe}>a</p>", true],
    ["<p hidden={on}>a</p>", false],
    ['<iframe title="t" src={label}></iframe>', false],
    ['<iframe title="t" sandbox={label}></iframe>', false],
  ])("binds %s: %s", (jsx, accepted) => {
    const { diagnostics } = attributes(jsx);
    expect(diagnostics.length === 0).toBe(accepted);
    if (!accepted) expect(codes(diagnostics)).toEqual(["UF1002"]);
  });

  it("keeps the M0 checks of a name for a binding: events, form state, `is`", () => {
    for (const [jsx, code] of [
      ["<button onClick={label}>a</button>", "UF1002"],
      ['<input type="text" value={label} />', "UF1002"],
      ["<p is={label}>a</p>", "UF3005"],
      ["<p srcdoc={label}>a</p>", "UF3006"],
    ] as const) {
      expect(codes(attributes(jsx).diagnostics), jsx).toEqual([code]);
    }
  });

  it("reports a bound ARIA value or role ARIA does not define (UF3008)", () => {
    const props = 'live: "polite" | "loud"; role: "button" | "widget"';
    expect(codes(attributes("<p aria-live={live}>a</p>", props).diagnostics)).toEqual(["UF3008"]);
    expect(codes(attributes("<p role={role}>a</p>", props).diagnostics)).toEqual(["UF3008"]);
    expect(
      attributes("<p aria-current={tone === 'info' ? 'page' : 'step'}>a</p>").diagnostics,
    ).toEqual([]);
  });
});

describe("literals in braces (UF3004)", () => {
  it.each([
    ['<p title={"x"}>a</p>', '<p title="x">a</p>'],
    ["<p title={`x`}>a</p>", '<p title="x">a</p>'],
    ['<input type="text" disabled={true} />', '<input type="text" disabled />'],
    ['<input type="text" disabled={false} />', '<input type="text" />'],
    ["<p hidden={true}>a</p>", "<p hidden>a</p>"],
    ["<p title={null}>a</p>", "<p>a</p>"],
    ["<p title={undefined}>a</p>", "<p>a</p>"],
    ["<p tabindex={0}>a</p>", '<p tabindex="0">a</p>'],
    ["<p tabindex={-1}>a</p>", '<p tabindex="-1">a</p>'],
    ["<p aria-hidden={true}>a</p>", "<p aria-hidden>a</p>"],
    ["<p aria-hidden={false}>a</p>", '<p aria-hidden="false">a</p>'],
    ['<p class={"a"}>a</p>', '<p class="a">a</p>'],
    ['<p style={"color: red"}>a</p>', '<p style="color: red">a</p>'],
  ])("writes %s as %s", (jsx, fixed) => {
    const { source, diagnostics } = attributes(jsx);
    expect(codes(diagnostics)).toEqual(["UF3004"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });

  it("accepts a string a JSX attribute would read differently, as written", () => {
    expect(lowered("<p title={'Say \"hi\" & wave'}>a</p>")).toEqual([
      'title="Say \\"hi\\" & wave"',
    ]);
    expect(lowered('<p title={"a\\nb"}>a</p>')).toEqual(['title="a\\nb"']);
  });

  it("lets the value's own fix win, and reports the rest once", () => {
    for (const [jsx, fixed] of [
      ['<input type="text" disabled={"disabled"} />', '<input type="text" disabled />'],
      ['<textarea rows={"03"}></textarea>', '<textarea rows="3"></textarea>'],
      ['<p class={"  "}>a</p>', "<p>a</p>"],
    ] as const) {
      const { source, diagnostics } = attributes(jsx);
      expect(codes(diagnostics), jsx).toEqual(["UF3004"]);
      expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
    }
  });

  it("keeps a problem the literal's rewrite does not fix", () => {
    const { source, diagnostics } = attributes('<a href={"javascript:x"}>a</a>');
    expect(codes(diagnostics)).toEqual(["UF3008", "UF3004"]);
    expect(applyAndRecheck(source, diagnostics)).toContain('<a href="javascript:x">');
  });

  it("offers no removal that would hide another problem", () => {
    const { source, diagnostics } = attributes('<input type="text" value={null} />');
    expect(codes(diagnostics)).toEqual(["UF1002", "UF3004"]);
    expect(diagnostics[1]!.fixes).toBeUndefined();
    applyAndRecheck(source, diagnostics);
  });

  it("renames and rewrites one attribute in two steps", () => {
    const { source, diagnostics } = attributes('<p Title={"x"}>a</p>');
    expect(codes(diagnostics)).toEqual(["UF3004", "UF3004"]);
    expect(diagnostics[1]!.fixes).toBeUndefined();
    const once = applyAndRecheck(source, diagnostics);
    const { diagnostics: again } = component(
      once.slice(once.indexOf("<p"), once.lastIndexOf(">") + 1),
      { props: PROPS },
    );
    expect(codes(again)).toEqual(["UF3004"]);
  });
});

describe("static values", () => {
  it.each([
    ['<p tabindex="">a</p>', "UF3008"],
    ['<p tabindex="x">a</p>', "UF3008"],
    ['<p tabindex="Infinity">a</p>', "UF3008"],
    ['<div><img src="/a.png" alt="" width="10px" /></div>', "UF3008"],
    ['<p aria-level="1.5">a</p>', "UF3008"],
    ['<p aria-hidden="yes">a</p>', "UF3008"],
    ['<p aria-live="loud">a</p>', "UF3008"],
    ['<p aria-relevant="additions nope">a</p>', "UF3008"],
    ['<p aria-label="">a</p>', "UF3008"],
    ['<p role="widget">a</p>', "UF3008"],
    ['<p role="buton">a</p>', "UF3008"],
  ])("reports %s", (jsx, code) => {
    expect(codes(attributes(jsx).diagnostics)).toEqual([code]);
  });

  it.each([
    ['<p tabindex="01">a</p>', 'tabindex="1"'],
    ['<p aria-valuenow="0.50">a</p>', 'aria-valuenow="0.5"'],
    ['<p tabindex="1e1">a</p>', 'tabindex="10"'],
  ])("rewrites the number in %s, which React and Qwik write as a literal", (jsx, fixed) => {
    const { source, diagnostics } = attributes(jsx);
    expect(codes(diagnostics)).toEqual(["UF3004"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });

  it.each([
    '<p aria-hidden="true" aria-live="POLITE" aria-relevant="additions text" role="button note">a</p>',
    '<p aria-level="2" aria-valuenow="-1.5" aria-describedby="a b" tabindex="-1">a</p>',
    '<td colspan="2">a</td>',
  ])("accepts %s", (jsx) => {
    const wrapped = jsx.startsWith("<td") ? `<table><tbody><tr>${jsx}</tr></tbody></table>` : jsx;
    expect(attributes(wrapped).diagnostics).toEqual([]);
  });
});

describe("class", () => {
  it.each([
    ['class={["a", label]}', '"a", {label}'],
    ['class={["a", [`b-${tone}`, on && "c d"]]}', '"a", {`b-${tone}`}, c?on, d?on'],
    [
      'class={{ active: on, "x y": count > 1, z: true }}',
      "active?on, x?count > 1, y?count > 1, z?true",
    ],
    ['class={on ? "a" : "b"}', '{on ? "a" : "b"}'],
    ["class={maybe}", "{maybe}"],
    ['class={["a", false, null, undefined, { b: false }, label]}', '"a", {label}'],
  ])("lowers %s", (attribute, items) => {
    expect(lowered(`<p ${attribute}>a</p>`)).toEqual([`class[${items}]`]);
  });

  it.each([
    ['<p class={["a", "b c"]}>x</p>', '<p class="a b c">x</p>'],
    ["<p class={{ a: true, b: true }}>x</p>", '<p class="a b">x</p>'],
    ['<p class={["a", false, { b: false }]}>x</p>', '<p class="a">x</p>'],
    ["<p class={[]}>x</p>", "<p>x</p>"],
  ])("writes the static class %s as a string", (jsx, fixed) => {
    const { source, diagnostics } = attributes(jsx);
    expect(codes(diagnostics)).toEqual(["UF3004"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });

  it.each([
    ['class={["a", count]}', "UF3018"],
    ['class={["a", on]}', "UF3018"],
    ["class={items}", "UF1002"],
    ['class={{ ["k"]: on }}', "UF3022"],
    ["class={{ ...user }}", "UF3022"],
    ['class={{ "": on }}', "UF3022"],
    ['class={["a", "a"]}', "UF3007"],
    ['class={["a b", { b: on }]}', "UF3007"],
    ['class={["a\\u00a0b", label]}', "UF3008"],
  ])("reports %s", (attribute, code) => {
    expect(codes(attributes(`<p ${attribute}>x</p>`).diagnostics)).toContain(code);
  });

  it("writes `cond && expr` as a conditional, which renders the same names", () => {
    const { source, diagnostics } = attributes('<p class={["a", on && label]}>x</p>');
    expect(codes(diagnostics)).toEqual(["UF3018"]);
    expect(applyAndRecheck(source, diagnostics)).toContain('class={["a", on ? label : undefined]}');
  });

  it("merges one spread's class with the element's own", () => {
    expect(lowered('<a {...classAttrs} class={["a", label]}>x</a>')).toEqual([
      "...{classAttrs}[class rel]",
      'class["a", {label}]',
    ]);
    expect(codes(attributes('<p class="a" class={label}>x</p>').diagnostics)).toEqual(["UF3007"]);
  });
});

describe("style", () => {
  it("lowers a static style string, as written", () => {
    expect(
      lowered('<p style="--Gap: 2px; COLOR: red;  border-left: 4px solid var(--Gap) ">a</p>'),
    ).toEqual(["style[--Gap: 2px; color: red; border-left: 4px solid var(--Gap)]"]);
  });

  it("lowers a style object: camel case, custom properties, unitless numbers", () => {
    expect(
      lowered(
        '<p style={{ color: label, marginTop: "4px", "--gap": count, lineHeight: 1.5, opacity: count, width: ` ${count}px ` }}>a</p>',
      ),
    ).toEqual([
      "style[color: {label}; margin-top: 4px; --gap: {count}; line-height: {1.5}; opacity: {count}; width: {` ${count}px `}]",
    ]);
  });

  it.each([
    ['style="color red"', "UF3022"],
    ['style="color: red; color: blue"', "UF3022"],
    ['style="margin: 0; margin-top: 1px"', "UF3022"],
    ['style="margin-left: 0; margin-inline-start: 1px"', "UF3022"],
    ['style="color: red !important"', "UF3022"],
    ['style="color: "', "UF3022"],
    ['style="-webkit-line-clamp: 2"', "UF1002"],
    ['style="display: table-row"', "UF1002"],
    ["style={{ margin: 0, marginTop: label }}", "UF3022"],
    ['style={{ color: "red !important" }}', "UF3022"],
    ["style={{ WebkitLineClamp: count }}", "UF1002"],
    ["style={{ [label]: 1 }}", "UF3022"],
    ["style={{ ...user }}", "UF3022"],
    ["style={{ color: on }}", "UF3018"],
    ["style={{ marginTop: count }}", "UF3018"],
    ["style={user}", "UF1002"],
    ['style={{ colour1: "red" }}', "UF3022"],
  ])("reports %s", (attribute, code) => {
    expect(codes(attributes(`<p ${attribute}>a</p>`).diagnostics)).toContain(code);
  });

  it.each([
    ['<p style={{ "margin-top": "4px" }}>a</p>', '<p style={{ marginTop: "4px" }}>a</p>'],
    ["<p style={{ marginTop: 4 }}>a</p>", '<p style={{ marginTop: "4px" }}>a</p>'],
    ['<p style="">a</p>', "<p>a</p>"],
    ["<p style={{}}>a</p>", "<p>a</p>"],
  ])("fixes %s", (jsx, fixed) => {
    const { source, diagnostics } = attributes(jsx);
    expect(diagnostics.every((diagnostic) => diagnostic.fixes?.length)).toBe(true);
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });

  it("offers no camel-case rename that would set a property twice", () => {
    const { diagnostics } = attributes(
      '<p style={{ "margin-top": "1px", marginTop: "2px" }}>a</p>',
    );
    expect(codes(diagnostics)).toEqual(["UF3004", "UF3022"]);
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });
});

describe("spreads", () => {
  it("lowers a spread of a typed prop, with its declared keys", () => {
    expect(lowered('<p {...attrs} class="a">x</p>')).toEqual(["...{attrs}[id title]", 'class="a"']);
    expect(lowered("<a {...linkAttrs}>x</a>")).toEqual(["...{linkAttrs}[href class]"]);
  });

  it.each([
    ['<p id="a" {...attrs}>x</p>', "UF3007"],
    ["<p {...attrs} {...attrs}>x</p>", "UF3007"],
    ["<p {...items}>x</p>", "UF1002"],
    ["<p {...label}>x</p>", "UF1002"],
    ["<p {...user}>x</p>", "UF3006"],
    ["<input {...attrs} />", undefined],
  ])("checks the keys of the spread in %s", (jsx, code) => {
    const { diagnostics } = attributes(jsx);
    if (code) expect(codes(diagnostics)).toContain(code);
    else expect(diagnostics).toEqual([]);
  });

  it.each([
    ["{ onClick: () => void }", "UF1002"],
    ["{ style: string }", "UF1002"],
    ["{ key: string }", "UF1002"],
    ["{ className: string }", "UF3004"],
    ["{ hidden: boolean }", "UF1002"],
    ["{ title: number }", "UF3018"],
  ])("reports a spread whose type is %s", (type, code) => {
    const props = `extra: ${type}`;
    expect(codes(attributes("<p {...extra}>x</p>", props).diagnostics)).toContain(code);
  });

  it("writes a spread object literal as its attributes", () => {
    const { source, diagnostics } = attributes('<p {...{ id: "a", title: label }}>x</p>');
    expect(codes(diagnostics)).toEqual(["UF3004"]);
    expect(applyAndRecheck(source, diagnostics)).toContain('<p id="a" title={label}>x</p>');
    const unsafe = attributes("<p {...{ className: label }}>x</p>");
    expect(unsafe.diagnostics[0]!.fixes).toBeUndefined();
  });
});

// Angular writes an element with a static attribute holding `{{` in an `ngNonBindable` region,
// where nothing binds (ADR-0037).
describe("attributes holding `{{`", () => {
  it.each([
    ['<p title="{{ x }}">a</p>', true],
    ['<p title="{{ x }}" class="a" style="color: red">a <b data-x="1">b</b></p>', true],
    ['<p title={"{{ x }}"}>a</p>', true],
    ['<p title="{{ x }}" data-x={label}>a</p>', false],
    ['<p title="{{ x }}">{label}</p>', false],
    ['<p title="{{ x }}"><b title={label}>b</b></p>', false],
    ['<p title="{{ x }}">{on && <b>b</b>}</p>', false],
    ['<ul title="{{ x }}">{items.map((item) => <li key={item}>a</li>)}</ul>', false],
    ['<p title="{{ x }}" class={["a", label]}>a</p>', false],
    ['<p title="{{ x }}" style={{ color: label }}>a</p>', false],
    ['<p title="{{ x }}" {...attrs}>a</p>', false],
    ['<div><p title="{{ x }}">a</p>{label}</div>', true],
  ])("lowers %s alone: %s", (jsx, accepted) => {
    const { diagnostics } = attributes(jsx);
    const literal = diagnostics.filter((diagnostic) =>
      diagnostic.message.includes("ngNonBindable"),
    );
    expect(literal.length).toBe(accepted ? 0 : 1);
  });
});
