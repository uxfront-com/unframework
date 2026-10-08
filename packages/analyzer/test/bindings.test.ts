import type { Attribute, RenderNode, UfModule } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { enumeratedProblem } from "../src/enumerated.ts";
import { NULL, STRING, union, UNKNOWN } from "../src/types/kinds.ts";
import { applyAndRecheck, codes, component, only, problems, root } from "./helpers.ts";

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

/** The spreads anywhere in a module's one component, in a compact form. */
function spreadsOf(module: UfModule | undefined): string[] {
  const found: string[] = [];
  const visit = (node: RenderNode): void => {
    if (node.kind === "Element") {
      for (const attribute of node.attributes) {
        if (attribute.kind === "Spread") found.push(describeAttribute(attribute));
      }
      node.children.forEach(visit);
    } else if (node.kind === "If") {
      for (const branch of node.branches) branch.children.forEach(visit);
    } else if (node.kind === "For") {
      visit(node.body);
    }
  };
  const { render } = only(module);
  if (render.kind === "Fragment") render.children.forEach(visit);
  else visit(render);
  return found;
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
      // `?.` marks a source that may be nullish, whose keys the targets read through `?.`.
      return `...{${attribute.value.code}}${attribute.nullish ? "?." : ""}[${attribute.keys.map((key) => key.name).join(" ")}]`;
    case "Event":
      return `on:${attribute.event}`;
    case "Ref":
      return `ref:${attribute.binding}`;
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
    ["<p aria-label={user}>a</p>", "user", "`aria-label` takes text"],
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
      ["<button onClick={label}>a</button>", "UF3029"],
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

// Svelte's, Solid's and Qwik's clients insert a <select>'s options before they set a bound
// attribute, so the browser has selected the first option by then.
describe("attributes that decide a <select>'s first selection", () => {
  const props = `${PROPS}; rows: number; sizes: { size: number }`;

  it.each([
    ['<select size={count}><option value="a">A</option></select>', "size"],
    ['<select multiple={on}><option value="a">A</option></select>', "multiple"],
    ['<select><option value="a" disabled={on}>A</option></select>', "disabled"],
    [
      '<select><optgroup label="g" disabled={on}><option value="a">A</option></optgroup></select>',
      "disabled",
    ],
  ])("reports a bound one in %s (UF1002)", (jsx, name) => {
    const { found, diagnostics } = attributes(jsx, props);
    expect(found).toEqual([`UF1002 ${name}`]);
    expect(diagnostics[0]!.message).toContain("decides which option starts selected");
  });

  it("reports one a spread sets, and accepts static ones", () => {
    const spread = attributes('<select {...sizes}><option value="a">A</option></select>', props);
    expect(codes(spread.diagnostics)).toEqual(["UF1002"]);
    expect(
      attributes(
        '<select size="3" multiple><optgroup label="g" disabled><option value="a" disabled>A</option></optgroup></select>',
        props,
      ).diagnostics,
    ).toEqual([]);
    expect(attributes("<button disabled={on}>b</button>", props).diagnostics).toEqual([]);
  });
});

// Svelte sets these elements' `value` property, which writes "0", "" or "null" once it is
// nullish, and Solid writes "0" for a `null` on an <li> or a <meter>: the others leave it out.
describe("a bound `value` that may be nullish", () => {
  const props =
    "score?: number; none: number | null; label?: string; items: string[]; attrs: { value?: number }";

  it.each([
    ["<ol><li value={score}>a</li></ol>", "li"],
    ["<ol><li value={none}>a</li></ol>", "li"],
    ['<meter min="0" max="10" value={score}>m</meter>', "meter"],
    ['<progress max="10" value={none}>p</progress>', "progress"],
    ["<data value={label}>d</data>", "data"],
    ['<button type="button" value={label}>b</button>', "button"],
    ['<input type="checkbox" name="c" value={label} />', "input"],
    ["<ol><li {...attrs}>a</li></ol>", "li"],
  ])("reports %s (UF1002)", (jsx, tag) => {
    const { diagnostics } = attributes(`<div>${jsx}</div>`, props);
    expect(codes(diagnostics)).toEqual(["UF1002"]);
    expect(diagnostics[0]!.message).toContain(`A bound \`value\` on <${tag}> that may be null`);
  });

  it.each([
    // A value that is there, a fallback, and a branch that renders only where it is there.
    '<meter min="0" max="10" value={score ?? 0}>m</meter>',
    '{score !== undefined && <meter min="0" max="10" value={score}>m</meter>}',
    "<ol>{items.map((item, index) => <li key={item} value={index + 1}>{item}</li>)}</ol>",
    '<data value={label ?? ""}>d</data>',
  ])("accepts %s", (jsx) => {
    expect(attributes(`<div>${jsx}</div>`, props).diagnostics).toEqual([]);
  });

  it('reports one on an <option>, which Svelte writes as "" and Solid as "null"', () => {
    const { diagnostics } = attributes(
      '<div><select name="s"><option value={label}>o</option></select></div>',
      props,
    );
    expect(codes(diagnostics)).toEqual(["UF1002"]);
    expect(diagnostics[0]!.message).toContain("<option>");
  });
});

// What some target's element types restrict beyond the authoring types (ADR-0037): enumerated
// attributes, and attributes typed as a string only. types-conformance.test.ts checks the tables
// against the targets' types.
describe("values the targets' types restrict (UF3018)", () => {
  const props = `${PROPS}; field: "email" | "username"; role: "button" | "tab"; newer: "generic"; rule: "evenodd" | "nonzero"; hide?: boolean; extra: { autocomplete: string }; known: { autocomplete?: "email"; title: string }`;

  it.each([
    [
      '<input type="text" autocomplete={label} />',
      "label",
      'only "on", "off", "name"',
      "for `autocomplete` on <input>, and this value can be any string.",
    ],
    [
      '<input type="text" autocomplete={tone} />',
      "tone",
      "35 more",
      'this value can be "info" or "warn".',
    ],
    ["<p aria-hidden={count}>a</p>", "count", '"true", "false" or a boolean', "can be a number."],
    ["<p contenteditable={on} />", "on", '"true", "false" or "inherit"', "can be a boolean."],
    ["<p draggable={label}>a</p>", "label", "accept only a boolean for `draggable`", "any string"],
    ["<p role={label}>a</p>", "label", 'only "alert", "alertdialog"', "any string"],
    ["<p role={newer}>a</p>", "newer", "for `role`", '"generic"'],
    [
      "<ol type={label}><li>a</li></ol>",
      "label",
      'only "1", "a", "A", "i" or "I" for `type` on <ol>',
      "any string",
    ],
    ["<input type={label} />", "label", '"checkbox"', "for `type` on <input>"],
    [
      '<svg><path d="M0 0" fill-rule={label} /></svg>',
      "label",
      '"nonzero", "evenodd" or "inherit"',
      "any string",
    ],
    ["<p aria-label={count}>a</p>", "count", "`aria-label` takes text", "a number"],
    ["<p aria-controls={on}>a</p>", "on", "`aria-controls` takes a list of ids", "a boolean"],
    [
      '<a href="/" download={count}>a</a>',
      "count",
      "declare `download` as a string only",
      "a number",
    ],
    ["<svg><path d={count} /></svg>", "count", "declare `d` as a string only", "a number"],
  ])("reports %s at the value", (jsx, at, accepted, can) => {
    const { found, diagnostics } = attributes(jsx, props);
    expect(found).toEqual([`UF3018 ${at}`]);
    expect(diagnostics[0]!.message).toContain(accepted);
    expect(diagnostics[0]!.message).toContain(can);
  });

  it("asks for a boolean where the targets take one only", () => {
    const { diagnostics } = attributes("<p spellcheck={label}>a</p>", props);
    expect(diagnostics[0]!.help).toBe("Bind a boolean.");
    expect(attributes("<p autocapitalize={label}>a</p>", props).diagnostics[0]!.help).toBe(
      'Bind one of the listed values, or a union of them: `cond ? "off" : "none"`.',
    );
  });

  it.each([
    '<input type="text" autocomplete={field} />',
    '<input type="text" autocomplete={on ? "on" : "off"} />',
    "<p aria-hidden={on}>a</p>",
    "<p aria-hidden={hide}>a</p>",
    "<p draggable={on}>a</p>",
    "<p role={role}>a</p>",
    "<p aria-label={label}>a</p>",
    "<p aria-level={count}>a</p>",
    '<svg><path d="M0 0" fill-rule={rule} /></svg>',
    '<svg><rect width={count} height="1" /></svg>',
    '<input type="text" {...known} />',
  ])("accepts %s", (jsx) => {
    expect(attributes(jsx, props).diagnostics).toEqual([]);
  });

  it("checks a spread's keys as bound values", () => {
    const { diagnostics } = attributes('<input type="text" {...extra} />', props);
    expect(codes(diagnostics)).toEqual(["UF3018"]);
    expect(diagnostics[0]!.message).toContain("for `autocomplete` on <input>");
  });

  it("leaves a value the kind model cannot type to the type checker (ADR-0035)", () => {
    expect(enumeratedProblem("input", "html", "autocomplete", UNKNOWN)).toBeUndefined();
    expect(
      enumeratedProblem("input", "html", "autocomplete", union(UNKNOWN, NULL)),
    ).toBeUndefined();
    expect(enumeratedProblem("p", "html", "title", STRING)).toBeUndefined();
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
    '<p aria-hidden="true" aria-live="polite" aria-relevant="additions text" role="button">a</p>',
    '<p aria-level="2" aria-valuenow="-1.5" aria-describedby="a b" tabindex="-1">a</p>',
    '<p dir="rtl" translate="no" draggable="false" spellcheck="true" inputmode="numeric">a</p>',
    '<p dir="auto">a</p>',
    '<p contenteditable="plaintext-only"></p>',
    '<div><input type="email" autocomplete="email" enterkeyhint="send" /></div>',
    '<div><img src="/a.png" alt="" loading="lazy" decoding="async" crossorigin="" /></div>',
    '<svg><path d="M0 0" fill-rule="evenodd" stroke-linecap="round" /></svg>',
    '<td colspan="2">a</td>',
  ])("accepts %s", (jsx) => {
    const wrapped = jsx.startsWith("<td") ? `<table><tbody><tr>${jsx}</tr></tbody></table>` : jsx;
    expect(attributes(wrapped).diagnostics).toEqual([]);
  });
});

// A static value of an attribute some target's types restrict to tokens (ADR-0037), as a bound
// one: types-conformance.test.ts checks the tokens against the targets' types.
describe("static values the targets' types restrict", () => {
  it.each([
    // Solid types a <bdo>'s direction without "auto", and every element's with it.
    ['<bdo dir="auto">a</bdo>', 'only "ltr" or "rtl" for `dir` on <bdo>, and "auto" is not one.'],
    ['<p draggable="auto">a</p>', 'only "true" or "false" for `draggable`'],
    ['<p role="button note">a</p>', "for `role`"],
    ['<p role="generic">a</p>', "for `role`"],
    ['<p aria-orientation="undefined">a</p>', "for `aria-orientation`"],
    ['<div><input type="text" autocomplete="bday" /></div>', "for `autocomplete` on <input>"],
    ['<button type="sumbit">b</button>', '"submit", "reset" or "button" for `type` on <button>'],
    ['<svg><g writing-mode="vertical-rl" /></svg>', "for `writing-mode`"],
    ['<svg><g fill-rule="EVENODD" /></svg>', "for `fill-rule`"],
    ['<ol type="X"><li>a</li></ol>', 'only "1", "a", "A", "i" or "I" for `type` on <ol>'],
  ])("reports %s (UF3008)", (jsx, message) => {
    const { found, diagnostics } = attributes(jsx);
    expect(found.map((item) => item.split(" ")[0])).toEqual(["UF3008"]);
    expect(diagnostics[0]!.message).toContain(message);
  });

  it.each([
    ['<p dir="RTL">a</p>', 'dir="rtl"'],
    ['<p aria-live="POLITE">a</p>', 'aria-live="polite"'],
    ['<p spellcheck="">a</p>', 'spellcheck="true"'],
    ['<p contenteditable=""></p>', 'contenteditable="true"'],
    ['<p translate="">a</p>', 'translate="yes"'],
    ['<button type="">b</button>', 'type="submit"'],
    ['<div><input type="" /></div>', 'type="text"'],
    ['<p dir={"LTR"}>a</p>', 'dir="ltr"'],
  ])("writes %s as the keyword the targets' types take (UF3004)", (jsx, fixed) => {
    const { source, diagnostics } = attributes(jsx);
    expect(codes(diagnostics)).toEqual(["UF3004"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });

  it("keeps the case where it matters: an ordered list's type, and SVG's keywords", () => {
    expect(attributes('<ol type="A"><li>a</li></ol>').diagnostics).toEqual([]);
    expect(
      codes(attributes('<svg><path d="M0 0" fill-rule="EvenOdd" /></svg>').diagnostics),
    ).toEqual(["UF3008"]);
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
  // Chromium's properties (`CSS_PROPERTIES`): a name outside them is almost always a typo.
  it.each([
    ['<p style="colr: red">a</p>', "colr", "Did you mean `color`?"],
    ['<p style="line-clamp: 2">a</p>', "line-clamp", undefined],
    ["<p style={{ marginTpo: label }}>a</p>", "marginTpo", "Did you mean `margin-top`?"],
    ['<p style={{ "text-colour": label }}>a</p>', '"text-colour"', undefined],
  ])("reports the unknown property in %s (UF3022)", (jsx, at, help) => {
    const { found, diagnostics } = attributes(jsx);
    expect(found).toEqual([`UF3022 ${at}`]);
    expect(diagnostics[0]!.message).toContain("is not a CSS property: no browser applies it.");
    if (help) expect(diagnostics[0]!.help).toBe(help);
  });

  it("accepts every property Chromium knows, and custom properties", () => {
    expect(
      lowered('<p style="field-sizing: content; --anything-at-all: 1; float: left">a</p>'),
    ).toEqual(["style[field-sizing: content; --anything-at-all: 1; float: left]"]);
  });

  it("lowers a static style string, as written", () => {
    expect(
      lowered('<p style="--gap: 2px; COLOR: red;  border-left: 4px solid var(--gap) ">a</p>'),
    ).toEqual(["style[--gap: 2px; color: red; border-left: 4px solid var(--gap)]"]);
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

  // Angular's compiler and its server DOM lowercase every property they parse.
  it.each([
    ['<p style="--Gap: 1px">a</p>', "--Gap", "`--gap`"],
    ['<p style={{ "--myColor": label }}>a</p>', '"--myColor"', "`--mycolor`"],
  ])("reports the upper-case custom property in %s (UF3022)", (jsx, at, help) => {
    const { found, diagnostics } = attributes(jsx);
    expect(found).toEqual([`UF3022 ${at}`]);
    expect(diagnostics[0]!.message).toContain("Angular's server renderer lowercases");
    expect(diagnostics[0]!.help).toContain(help);
  });

  // Angular's style parser knows no escapes or comments, and counts parentheses in strings.
  it.each([
    [`<p style={'content: "a\\\\";b"; color: red'}>a</p>`, `"a\\\\";b"`],
    [`<p style='content: "("; color: red'>a</p>`, `"("`],
    [`<p style={{ content: '"a\\\\"b"' }}>a</p>`, `'"a\\\\"b"'`],
    [`<p style={{ color: "red /* it's */" }}>a</p>`, `"red /* it's */"`],
    [`<p style={{ color: "red /* a; b */" }}>a</p>`, `"red /* a; b */"`],
  ])("reports a value Angular's style parser misreads: %s (UF3022)", (jsx, at) => {
    const { found, diagnostics } = attributes(jsx);
    expect(found).toEqual([`UF3022 ${at}`]);
    expect(diagnostics[0]!.message).toContain("Angular's style parser reads");
  });

  it("accepts values Angular's style parser reads as CSS does", () => {
    expect(
      lowered(
        `<p style='font-family: "A;B", serif; content: ")" "("; quotes: "\\"" "\\""; margin: 1px/**/2px'>a</p>`,
      ),
    ).toEqual([
      `style[font-family: "A;B", serif; content: ")" "("; quotes: "\\"" "\\""; margin: 1px/**/2px]`,
    ]);
  });

  // ADR-0038 defers vendor prefixes and table-part displays to M4.
  it.each([
    ['<p style="-webkit-line-clamp: 2">a</p>', "Vendor-prefixed properties"],
    ["<p style={{ WebkitLineClamp: count }}>a</p>", "Vendor-prefixed properties"],
    ['<p style="display: table-row">a</p>', "A `display` that makes a table part"],
  ])("names the milestone that lands %s", (jsx, message) => {
    const [diagnostic] = attributes(jsx).diagnostics;
    expect(diagnostic!.code).toBe("UF1002");
    expect(diagnostic!.message).toContain(message);
    expect(diagnostic!.message).toMatch(/lands? in M4\.$/);
  });

  // React adds no `px` to a number on SVG's stroke and opacity properties, as Qwik does.
  it.each([
    ["marginTop: 4", "`margin-top` renders with `px` on React and Qwik", '"4px"'],
    ["strokeWidth: 2", "`stroke-width` renders with `px` on Qwik and", '"2"'],
    ["fillOpacity: 0.5", "`fill-opacity` renders with `px` on Qwik and", '"0.5"'],
  ])(
    "says which targets add `px` to %s, and fixes it as React renders it",
    (entry, message, fix) => {
      const { source, diagnostics } = attributes(`<p style={{ ${entry} }}>a</p>`);
      expect(codes(diagnostics)).toEqual(["UF3018"]);
      expect(diagnostics[0]!.message).toContain(`A number on ${message}`);
      expect(diagnostics[0]!.fixes?.[0]?.title).toBe(`Write \`${fix}\``);
      expect(applyAndRecheck(source, diagnostics)).toContain(
        `style={{ ${entry.split(":")[0]}: ${fix} }}`,
      );
    },
  );

  // React and Qwik leave a 0 bare, as the others do: it is the declaration `margin: 0`.
  it("takes a literal 0 on any property as the static value 0", () => {
    expect(
      lowered("<p style={{ margin: 0, strokeWidth: 0, flexGrow: 0, padding: 0.0 }}>a</p>"),
    ).toEqual(["style[margin: 0; stroke-width: 0; flex-grow: {0}; padding: 0]"]);
  });
});

describe("spreads", () => {
  it("lowers a spread of a typed prop, with its declared keys", () => {
    expect(lowered('<p {...attrs} class="a">x</p>')).toEqual(["...{attrs}[id title]", 'class="a"']);
    expect(lowered("<a {...linkAttrs}>x</a>")).toEqual(["...{linkAttrs}?.[href class]"]);
  });

  // A spread of `null` or `undefined` renders no key, so a source that may be nullish reads its
  // keys through `?.` (the IR's `nullish`), whatever its form; one that cannot be reads them
  // through `.`, which Angular requires (NG8107).
  it.each([
    ["{...attrs}", "...{attrs}[id title]"],
    ["{...linkAttrs}", "...{linkAttrs}?.[id title]"],
    ["{...nothing}", "...{nothing}?.[id title]"],
    ["{...hint}", "...{hint}?.[id title]"],
    ["{...box.fixed}", "...{box.fixed}[id title]"],
    ["{...box.inner}", "...{box.inner}?.[id title]"],
    ["{...(on ? attrs : undefined)}", "...{on ? attrs : undefined}?.[id title]"],
    ["{...list[0]}", "...{list[0]}?.[id title]"],
    [
      "{...list.find((item) => item.id === label)}",
      "...{list.find((item) => item.id === label)}?.[id title]",
    ],
  ])("records whether the source of %s may be nullish", (spread, expected) => {
    const props =
      "label: string; on: boolean; attrs: Attrs; linkAttrs?: Attrs; nothing: Attrs | null; hint?: Attrs | null; box: Box; list: Attrs[]";
    const before =
      "interface Attrs { id: string; title?: string }\ninterface Box { fixed: Attrs; inner?: Attrs }\n";
    const pattern = "{ label, on, attrs, linkAttrs, nothing, hint = null, box, list }";
    const { module, diagnostics } = component(`<p ${spread}>x</p>`, { props, before, pattern });
    expect(diagnostics).toEqual([]);
    expect(root(module).attributes.map(describeAttribute)).toEqual([expected]);
  });

  it("reads a list's item that may be absent through `?.`", () => {
    const { module, diagnostics } = component(
      "<ul>{rows.map((row, index) => <li key={index} {...row}>x</li>)}</ul>",
      { props: "rows: (Attrs | undefined)[]", before: "interface Attrs { id?: string }\n" },
    );
    expect(diagnostics).toEqual([]);
    expect(spreadsOf(module)).toEqual(["...{row}?.[id]"]);
  });

  // The conditions around a spread narrow its source as TypeScript, and so every target's
  // checker, does: there it is an object, read through `.`, which Angular requires of a member
  // it has narrowed (NG8107).
  it.each([
    ["{linkAttrs && <p {...linkAttrs}>x</p>}", "...{linkAttrs}[id title]"],
    ["{on && linkAttrs && <p {...linkAttrs}>x</p>}", "...{linkAttrs}[id title]"],
    ["{(linkAttrs && on) ? <p {...linkAttrs}>x</p> : null}", "...{linkAttrs}[id title]"],
    ["{!linkAttrs ? null : <p {...linkAttrs}>x</p>}", "...{linkAttrs}[id title]"],
    ["{on ? null : !box.inner ? <i>y</i> : <p {...box.inner}>x</p>}", "...{box.inner}[id title]"],
    ["{box.inner ? <p {...box.inner}>x</p> : <i>y</i>}", "...{box.inner}[id title]"],
    ["{on ? null : (box.inner && <p {...box.inner}>x</p>)}", "...{box.inner}[id title]"],
    // What fails says nothing of the source, unless it is the source alone; nor does a test of
    // something else.
    ["{box.inner?.title ? <i>y</i> : <p {...box.inner}>x</p>}", "...{box.inner}?.[id title]"],
    ["{box.inner && on ? <i>y</i> : <p {...box.inner}>x</p>}", "...{box.inner}?.[id title]"],
    ["{on && <p {...linkAttrs}>x</p>}", "...{linkAttrs}?.[id title]"],
    ["{box.fixed && <p {...box.inner}>x</p>}", "...{box.inner}?.[id title]"],
    // Any operand of an `&&`, a comparison with `undefined` and a member through `?.` narrow it
    // too, as TypeScript narrows it.
    ["{box.inner !== undefined && <p {...box.inner}>x</p>}", "...{box.inner}[id title]"],
    ["{linkAttrs?.id && <p {...linkAttrs}>x</p>}", "...{linkAttrs}[id title]"],
    ["{linkAttrs && on ? <p {...linkAttrs}>x</p> : <i>y</i>}", "...{linkAttrs}[id title]"],
    [
      "{on ? <i>y</i> : linkAttrs && on ? <p {...linkAttrs}>x</p> : null}",
      "...{linkAttrs}[id title]",
    ],
    // `!` and `||` as TypeScript reads them.
    ["{!(on || !box.inner) && <p {...box.inner}>x</p>}", "...{box.inner}[id title]"],
    ["{(on || box.inner) && <p {...box.inner}>x</p>}", "...{box.inner}?.[id title]"],
    // A closure keeps the narrowing of a parameter, never of a property: a destructured prop a
    // conditional child narrows is one in its branch (Solid's keyed callback receives it).
    [
      "{linkAttrs && <ul>{list.map((item) => <li key={item.id} {...linkAttrs}>x</li>)}</ul>}",
      "...{linkAttrs}[id title]",
    ],
    // A test the compiler does not follow, of a prop: read through `?.` too.
    ["{linkAttrs?.id === label ? <p {...linkAttrs}>x</p> : null}", "...{linkAttrs}?.[id title]"],
    [
      "<ul>{list.map((item) => <li key={item.id}>{box.inner && <p {...box.inner}>x</p>}</li>)}</ul>",
      "...{box.inner}[id title]",
    ],
  ])("narrows the source in %s", (jsx, expected) => {
    const props = "label: string; on: boolean; linkAttrs?: Attrs; box: Box; list: Attrs[]";
    const before =
      "interface Attrs { id: string; title?: string }\ninterface Box { fixed: Attrs; inner?: Attrs }\n";
    const { module, diagnostics } = component(`<div>${jsx}</div>`, { props, before });
    expect(diagnostics).toEqual([]);
    expect(spreadsOf(module)).toEqual([expected]);
  });

  it("removes a spread whose source a condition shows to be absent (UF3004)", () => {
    const options = {
      props: "linkAttrs?: Attrs; on: boolean",
      before: "interface Attrs { id: string }\n",
    };
    for (const jsx of [
      "<div>{linkAttrs ? null : <p {...linkAttrs}>x</p>}</div>",
      "<div>{!on && !linkAttrs && <p {...linkAttrs}>x</p>}</div>",
    ]) {
      const { source, diagnostics } = component(jsx, options);
      expect(problems(source, diagnostics)).toEqual(["UF3004 {...linkAttrs}"]);
      expect(diagnostics[0]!.message).toBe(
        "This spread renders nothing: a condition around it holds only where its source is absent.",
      );
      expect(applyAndRecheck(source, diagnostics)).toContain("<p>x</p>");
    }
  });

  // Where the compiler cannot tell what the checkers narrow a member to, or Angular's loops keep
  // what a JSX target's callback forgets, `.` and `?.` may each fail one of them: it reports the
  // spread rather than guess.
  it.each([
    ["{box.inner?.title === label && <p {...box.inner}>x</p>}", "box.inner?.title === label"],
    [
      "{box.inner && <ul>{list.map((item) => <li key={item.id} {...box.inner}>x</li>)}</ul>}",
      "box.inner",
    ],
  ])("reports a spread whose source %s tests in a way it cannot follow (UF1002)", (jsx, test) => {
    const props = "label: string; on: boolean; linkAttrs?: Attrs; box: Box; list: Attrs[]";
    const before =
      "interface Attrs { id: string; title?: string }\ninterface Box { inner?: Attrs }\n";
    const { source, diagnostics } = component(`<div>${jsx}</div>`, { props, before });
    expect(codes(diagnostics)).toEqual(["UF1002"]);
    const [diagnostic] = diagnostics;
    expect(source.slice(diagnostic!.span.start, diagnostic!.span.end)).toMatch(/^\{\.\.\./);
    expect(diagnostic!.related?.map(({ span }) => source.slice(span.start, span.end))).toEqual([
      test,
    ]);
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

  it("removes a spread whose type declares no keys (UF3004)", () => {
    const options = { props: "none: Empty; label: string", before: "interface Empty {}\n" };
    const { source, diagnostics } = component("<p {...none}>x</p>", options);
    expect(problems(source, diagnostics)).toEqual(["UF3004 {...none}"]);
    expect(diagnostics[0]!.message).toBe("This spread renders nothing: its type declares no keys.");
    expect(applyAndRecheck(source, diagnostics)).toContain("<p>x</p>");
    // It binds nothing, so an element Angular writes as literal keeps its other attributes.
    const literal = component('<p title="{{ x }}" {...none}>x</p>', options);
    expect(codes(literal.diagnostics)).toEqual(["UF3004"]);
    expect(applyAndRecheck(literal.source, literal.diagnostics)).toContain(
      '<p title="{{ x }}">x</p>',
    );
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
