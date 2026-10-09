import {
  ELEMENT_ATTRIBUTES,
  ID_REFERENCE_ATTRIBUTES,
  isBooleanAttribute,
  isHtmlAttribute,
  REQUIRED_PARENTS,
  UNRENDERABLE_ELEMENTS,
  VOID_ELEMENTS,
} from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { nameProblem } from "../src/attribute-names.ts";
import { applyAndRecheck, codes, component, problems, root, slices } from "./helpers.ts";

/** The first element that has an attribute as its own. */
function ownerOf(name: string): string | undefined {
  return [...ELEMENT_ATTRIBUTES].find(([, names]) => names.has(name))?.[0];
}

/** The one diagnostic a component returning `jsx` gets, with the text its span covers. */
function only(jsx: string) {
  const { source, diagnostics } = component(jsx);
  expect(diagnostics, JSON.stringify(diagnostics, null, 2)).toHaveLength(1);
  const [diagnostic] = diagnostics;
  return { ...diagnostic!, at: slices(source, diagnostics)[0], source, diagnostics };
}

function attributesOf(jsx: string) {
  const { module, diagnostics } = component(jsx);
  expect(diagnostics).toEqual([]);
  return root(module).attributes.map((attribute) =>
    attribute.kind === "Static" ? [attribute.name, attribute.value] : [attribute.kind],
  );
}

describe("event attributes", () => {
  // HTML names are case-insensitive: the browser runs `ONCLICK` as `onclick`. A listener is
  // named as Vue names it (UF3004), and its handler is code, never a string (UF3029).
  it.each([
    ["onClick", []],
    ["onclick", ["UF3004 onclick"]],
    ["ONCLICK", ["UF3004 ONCLICK"]],
    ["OnClick", ["UF3004 OnClick"]],
    ["OnMouseEnter", ["UF3004 OnMouseEnter"]],
    ["onKeyDown", ["UF3004 onKeyDown"]],
    ["onClick$", ["UF3006 onClick$"]],
  ])("reads %s as a listener, whatever its case", (name, found) => {
    const { source, diagnostics } = component(`<button type="button" ${name}="go()">Go</button>`);
    expect(problems(source, diagnostics)).toEqual([...found, 'UF3029 "go()"']);
  });

  // M1 lowers `style` (ADR-0038): a name in another case is renamed like any other.
  it.each(["STYLE", "Style"])("reports %s as written style, and lowers it", (name) => {
    const diagnostic = only(`<p ${name}="color: red">a</p>`);
    expect([diagnostic.code, diagnostic.at]).toEqual(["UF3004", name]);
    expect(applyAndRecheck(diagnostic.source, diagnostic.diagnostics)).toContain(
      'style="color: red"',
    );
  });

  it("does not mistake names that only start like an event", () => {
    expect(attributesOf('<p data-on="y" data-onclick="z">a</p>')).toEqual([
      ["data-on", "y"],
      ["data-onclick", "z"],
    ]);
  });
});

describe("attribute names", () => {
  // Plan §4.6 and ADR-0017: React's names are diagnostics with a fix.
  it.each([
    ['<p className="x">a</p>', "className", "class"],
    ['<label htmlFor="i">a</label>', "htmlFor", "for"],
    ['<p tabIndex="0">a</p>', "tabIndex", "tabindex"],
    ["<input readOnly />", "readOnly", "readonly"],
    ["<video autoPlay playsInline />", "autoPlay", "autoplay"],
    ["<input DISABLED />", "DISABLED", "disabled"],
    ['<p ariaLabel="x">a</p>', "ariaLabel", "aria-label"],
    ['<p aria-Label="x">a</p>', "aria-Label", "aria-label"],
    ['<p data-fooBar="x">a</p>', "data-fooBar", "data-foobar"],
    ['<td colSpan="2">a</td>', "colSpan", "colspan"],
  ])("reports %s with a fix to the HTML name", (jsx, written, html) => {
    const jsxInContext = jsx.startsWith("<td")
      ? `<table><tbody><tr>${jsx}</tr></tbody></table>`
      : jsx;
    const { source, diagnostics } = component(jsxInContext);
    const diagnostic = diagnostics.find(
      (item) => source.slice(item.span.start, item.span.end) === written,
    )!;
    expect(diagnostic).toMatchObject({
      code: "UF3004",
      message: `\`${written}\` is written \`${html}\`: elements take HTML's attribute names, in lower case.`,
      fixes: [{ confidence: "safe", title: `Rename \`${written}\` to \`${html}\`` }],
    });
    const fixed = applyAndRecheck(source, diagnostics);
    expect(
      component(fixed.slice(fixed.indexOf("<"), fixed.lastIndexOf(">") + 1)).diagnostics,
    ).toEqual([]);
  });

  it("offers no rename that would set an attribute twice", () => {
    const { source, diagnostics } = component('<p className="a" class="b">a</p>');
    expect(codes(diagnostics)).toEqual(["UF3004", "UF3007"]);
    expect(slices(source, diagnostics)).toEqual(["className", "class"]);
    expect(diagnostics.every((diagnostic) => !diagnostic.fixes)).toBe(true);
  });

  it.each([
    ['<p class="a" class="b">a</p>', "class"],
    ['<p class="a" CLASS="b">a</p>', "CLASS"],
    ['<p id="a" ID="b">a</p>', "ID"],
  ])("reports %s as a duplicate, compared case-insensitively", (jsx, second) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3007"]);
    expect(slices(source, diagnostics)).toEqual([second]);
    expect(diagnostics[0]!.related).toEqual([
      expect.objectContaining({ message: "First set here" }),
    ]);
  });

  it.each([
    ['<p children="kid">a</p>', "children"],
    ['<p dangerouslySetInnerHTML="x">a</p>', "dangerouslySetInnerHTML"],
    ['<p suppressHydrationWarning="x">a</p>', "suppressHydrationWarning"],
    ['<p suppressContentEditableWarning="x">a</p>', "suppressContentEditableWarning"],
    ['<p classList="x">a</p>', "classList"],
    ['<p textContent="x">a</p>', "textContent"],
    ['<p innerText="x">a</p>', "innerText"],
    ['<p outerHTML="x">a</p>', "outerHTML"],
  ])("reports the framework prop in %s as reserved", (jsx, name) => {
    expect(only(jsx)).toMatchObject({ code: "UF3005", at: name });
  });

  // Angular's template syntax (target-angular-4) and the other frameworks' (core-7).
  it.each([
    "on-off",
    "bind-title",
    "bindon-value",
    "ref-foo",
    "let-item",
    "i18n",
    "i18n-title",
    "ngNonBindable",
    "ngProjectAs",
    "ngSkipHydration",
    "ngPreserveWhitespaces",
    "ng-version",
    "_ngcontent-x",
    "slot",
    "is",
    "nonce",
  ])("reports the template syntax %s as reserved", (name) => {
    expect(only(`<p ${name}="x">a</p>`)).toMatchObject({ code: "UF3005", at: name });
  });

  // The attributes frameworks add themselves: an authored one would be stripped or misread.
  it.each([
    "data-hk",
    "data-astro-cid-x",
    "data-astro-source-file",
    "data-v-7ba5bd90",
    "data-qwik-inspector",
    "data-uf-c3a1",
  ])("reports %s as reserved", (name) => {
    expect(only(`<p ${name}="x">a</p>`)).toMatchObject({ code: "UF3005", at: name });
  });

  it("accepts data attributes that only start like a reserved one", () => {
    expect(
      attributesOf('<p data-hkx="1" data-version="2" data-vue="3" data-ufo="4">a</p>'),
    ).toHaveLength(4);
  });

  it.each([
    ['<p foo="x">a</p>', "foo", "`foo` is not an attribute of <p>."],
    ['<div href="/x">a</div>', "href", "`href` is not an attribute of <div>."],
    ['<select type="x"></select>', "type", "`type` is not an attribute of <select>."],
    ['<a text="x" href="/">a</a>', "text", "`text` is not an attribute of <a>."],
    ['<select length="3"></select>', "length", "`length` is not an attribute of <select>."],
    [
      '<input indeterminate type="checkbox" />',
      "indeterminate",
      "`indeterminate` is not an attribute of <input>.",
    ],
    ['<p aria-foo="x">a</p>', "aria-foo", "`aria-foo` is not an ARIA attribute."],
    ['<p xlinkHref="x">a</p>', "xlinkHref", "`xlinkHref` is not an attribute of <p>."],
  ])("reports %s as unknown", (jsx, name, message) => {
    expect(only(jsx)).toMatchObject({ code: "UF3006", at: name, message });
  });

  it("names the elements an attribute belongs to", () => {
    expect(only('<div href="/x">a</div>').help).toBe(
      "`href` is an attribute of <a>, <area>, <base> and <link>.",
    );
  });

  it("reports a string ref, which is Vue's (UF3027)", () => {
    expect(only('<p ref="r">a</p>')).toMatchObject({ code: "UF3027", at: '"r"' });
  });

  it.each([
    ['<p v-if="x">a</p>', "v-if"],
    ['<p innerHTML="<b>x</b>">a</p>', "innerHTML"],
    ['<input defaultValue="v" />', "defaultValue"],
    ['<input type="checkbox" defaultChecked />', "defaultChecked"],
    ["<input autofocus />", "autofocus"],
  ])("reports %s as not supported yet", (jsx, name) => {
    expect(only(jsx)).toMatchObject({ code: "UF1002", at: name });
  });
});

describe("attribute values", () => {
  // Decision: `true` only for HTML's boolean attributes; JSX's bare attribute is "true" elsewhere.
  it('lowers a bare boolean attribute to true and a bare true-valued one to "true"', () => {
    expect(
      attributesOf(
        '<div hidden inert aria-hidden draggable spellcheck data-open title="t">a</div>',
      ),
    ).toEqual([
      ["hidden", true],
      ["inert", true],
      ["aria-hidden", "true"],
      ["draggable", "true"],
      ["spellcheck", "true"],
      ["data-open", "true"],
      ["title", "t"],
    ]);
  });

  it.each([
    ["<input placeholder />", "placeholder"],
    ['<a href="/x" download>a</a>', "download"],
    ["<p translate>a</p>", "translate"],
    ['<img src="/a.png" alt="" crossorigin />', "crossorigin"],
    ["<p title>a</p>", "title"],
    ["<p aria-label>a</p>", "aria-label"],
  ])("reports %s, whose bare form means something else in HTML", (jsx, name) => {
    expect(only(jsx)).toMatchObject({
      code: "UF3004",
      at: name,
      message: `\`${name}\` needs a value: in JSX an attribute without one means the string "true".`,
    });
  });

  it.each([
    '<input disabled="" />',
    '<input disabled="disabled" />',
    '<input disabled="DISABLED" />',
  ])("reports the redundant value in %s, and the fix removes it", (jsx) => {
    const diagnostic = only(jsx);
    expect(diagnostic).toMatchObject({
      code: "UF3004",
      message: "`disabled` is a boolean attribute: write it without a value.",
    });
    expect(applyAndRecheck(diagnostic.source, diagnostic.diagnostics)).toContain(
      "<input disabled />",
    );
  });

  it("fixes the case and the value of one attribute together", () => {
    const { source, diagnostics } = component('<input READONLY="readonly" />');
    expect(codes(diagnostics)).toEqual(["UF3004", "UF3004"]);
    expect(applyAndRecheck(source, diagnostics)).toContain("<input readonly />");
  });

  it('reports disabled="false", which is still disabled, without a fix', () => {
    const diagnostic = only('<input disabled="false" />');
    expect(diagnostic).toMatchObject({
      code: "UF3004",
      message:
        '`disabled` is a boolean attribute: it is on whenever it is present, so `disabled="false"` is on too.',
    });
    expect(diagnostic.fixes).toBeUndefined();
  });

  it('reports hidden="until-found", which React renders as a boolean', () => {
    expect(only('<p hidden="until-found">a</p>')).toMatchObject({ code: "UF3008", at: "hidden" });
  });

  it.each([
    '<a href="javascript:alert(1)">a</a>',
    '<a href=" JavaScript:alert(1)">a</a>',
    '<a href="java&#9;script:alert(1)">a</a>',
    '<form action="javascript:void 0"></form>',
    '<iframe src="javascript:x" title="t"></iframe>',
  ])("reports the javascript: URL in %s", (jsx) => {
    expect(only(jsx).code).toBe("UF3008");
  });

  // A document the compiler would copy into every output unanalysed, scripts included, which
  // runs as the page's origin unless sandboxed (r3-analyzer-6).
  it.each([
    [
      '<iframe srcdoc="&lt;script&gt;parent.document.title=1&lt;/script&gt;" title="t"></iframe>',
      "srcdoc",
    ],
    ['<iframe srcdoc="" title="t"></iframe>', "srcdoc"],
    ['<iframe srcdoc title="t"></iframe>', "srcdoc"],
    ['<iframe srcDoc="&lt;p&gt;x&lt;/p&gt;" title="t"></iframe>', "srcDoc"],
  ])("reports the HTML document in %s", (jsx, name) => {
    expect(only(jsx)).toMatchObject({
      code: "UF3008",
      at: name,
      message:
        "`srcdoc` holds an HTML document, scripts included, which the compiler cannot analyse.",
    });
  });

  it.each([
    '<iframe src="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;" title="t"></iframe>',
    '<iframe src=" DATA:text/html,x" title="t"></iframe>',
    '<object data="data:text/html,x"></object>',
    '<embed src="data:image/svg+xml,x" />',
  ])("reports the data: document a frame would load in %s", (jsx) => {
    expect(only(jsx)).toMatchObject({
      code: "UF3008",
      message: expect.stringContaining("the compiler cannot analyse one written in a `data:` URL"),
    });
  });

  // An image, a link a user follows, and content the page creates at run time run no code the
  // source holds.
  it.each([
    '<img src="data:image/svg+xml,x" alt="" />',
    '<a href="data:text/plain,x" download="x.txt">a</a>',
    '<iframe src="blob:https://example.com/0c4f" title="t"></iframe>',
    '<iframe src="/data:x" title="t"></iframe>',
  ])("accepts the URL in %s", (jsx) => {
    expect(component(jsx).diagnostics).toEqual([]);
  });

  it.each([
    '<img src="" alt="" />',
    '<object data=""></object>',
    '<map name="m"><area href="" alt="" /></map>',
  ])("reports the empty URL in %s, which React drops", (jsx) => {
    expect(only(jsx).code).toBe("UF3008");
  });

  it("accepts an empty href on a link, which React keeps", () => {
    expect(attributesOf('<a href="">a</a>')).toEqual([["href", ""]]);
  });

  it.each([
    ['<textarea rows="03"></textarea>', '"3"'],
    ['<meter value="0.50">a</meter>', '"0.5"'],
    ['<meter value=".5">a</meter>', '"0.5"'],
    ['<progress max="1e2">a</progress>', '"100"'],
    ['<ol start="-0"><li>a</li></ol>', '"0"'],
  ])("rewrites the number in %s to its canonical form", (jsx, canonical) => {
    const diagnostic = only(jsx);
    expect(diagnostic.code).toBe("UF3004");
    expect(applyAndRecheck(diagnostic.source, diagnostic.diagnostics)).toContain(`=${canonical}`);
  });

  it.each([
    '<textarea rows="0"></textarea>',
    '<textarea cols="x"></textarea>',
    '<select size="0"></select>',
    '<input size="0" />',
    '<ol start="1e1"><li>a</li></ol>',
    '<ul><li value="+3">a</li></ul>',
    '<ul><li value="3000000000">a</li></ul>',
    '<table><colgroup><col span="1001" /></colgroup></table>',
    '<meter value="half">a</meter>',
    '<input width="50%" />',
  ])("reports the number in %s, which renderers rewrite or reject", (jsx) => {
    expect(only(jsx).code).toBe("UF3008");
  });

  it("accepts numbers in canonical form", () => {
    expect(
      attributesOf(
        '<meter value="0.5" min="-1" max="1e+21" low="0" high="1" optimum="0.25">a</meter>',
      ),
    ).toHaveLength(6);
  });
});

describe("form state", () => {
  // Until v-model (M3): each target sets these as a DOM property or as an attribute.
  it.each([
    ['<input value="v" />', "value"],
    ['<input type="text" value="v" />', "value"],
    ['<input type="checkbox" checked />', "checked"],
    ['<textarea value="x"></textarea>', "value"],
    ['<select value="b"></select>', "value"],
    ['<output value="x">a</output>', "value"],
    ['<select><option value="b" selected>B</option></select>', "selected"],
    ["<video muted></video>", "muted"],
    ["<audio muted></audio>", "muted"],
  ])("reports %s as not supported yet", (jsx, name) => {
    expect(only(jsx)).toMatchObject({ code: "UF1002", at: name });
  });

  it.each(["submit", "reset", "button", "hidden", "image", "checkbox", "radio"])(
    "accepts the fixed value of an input of type %s",
    (type) => {
      expect(attributesOf(`<input type="${type}" value="v" />`)).toEqual([
        ["type", type],
        ["value", "v"],
      ]);
    },
  );

  // `type` is an enumerated attribute: its keywords are case-insensitive, so they decide alike,
  // and the targets' types take them in lower case.
  it.each(["Submit", "CHECKBOX"])("reads an input's type %s in any case", (type) => {
    const { source, diagnostics } = component(`<input type="${type}" value="v" />`);
    expect(problems(source, diagnostics)).toEqual(["UF3004 type"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      `<input type="${type.toLowerCase()}" value="v" />`,
    );
    const text = component('<input type="Text" value="v" />');
    expect(problems(text.source, text.diagnostics)).toEqual(["UF3004 type", "UF1002 value"]);
  });

  it("accepts an option's value and the value of a button", () => {
    expect(component('<select><option value="a">A</option></select>').diagnostics).toEqual([]);
    expect(attributesOf('<button value="go">Go</button>')).toEqual([["value", "go"]]);
  });

  it.each([
    ['<button type="button" formaction="/x">b</button>', "formaction"],
    ['<button type="reset" formmethod="post">b</button>', "formmethod"],
    ['<input type="text" formnovalidate />', "formnovalidate"],
  ])("reports the submission override in %s on a button that does not submit", (jsx, name) => {
    expect(only(jsx)).toMatchObject({ code: "UF3006", at: name });
  });

  // The type's case and an empty type are fixed apart, and decide as HTML reads them.
  it.each([
    ['<button type="BUTTON" formaction="/x">b</button>', ["UF3004 type", "UF3006 formaction"]],
    ['<input type="" formnovalidate />', ["UF3004 type", "UF3006 formnovalidate"]],
  ])("reports the submission override in %s, and the type's spelling", (jsx, found) => {
    const { source, diagnostics } = component(jsx);
    expect(problems(source, diagnostics)).toEqual(found);
    applyAndRecheck(source, diagnostics);
  });

  // HTML: a button's missing or invalid `type` is the Submit Button state (r3-analyzer-2). The
  // targets' types take only its keywords, so only the type is reported.
  it.each([
    ['type=""', "UF3004 type"],
    ['type="sumbit"', "UF3008 type"],
    ['type="menu"', "UF3008 type"],
  ])("accepts submission overrides on a <button %s>, which submits", (type, found) => {
    const { source, diagnostics } = component(`<button ${type} formaction="/a">b</button>`);
    expect(problems(source, diagnostics)).toEqual([found]);
  });

  it("fixes a bare type beside a submission override to a type that still submits", () => {
    const { source, diagnostics } = component(
      '<form><button type formaction="/save">Save</button></form>',
    );
    expect(codes(diagnostics)).toEqual(["UF3004"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      '<button type="submit" formaction="/save">',
    );
  });

  it("accepts submission overrides on submit buttons", () => {
    expect(component('<button formaction="/a">b</button>').diagnostics).toEqual([]);
    expect(
      codes(component('<button type="SUBMIT" formaction="/a">b</button>').diagnostics),
    ).toEqual(["UF3004"]);
    expect(component('<button type="submit" formtarget="_blank">b</button>').diagnostics).toEqual(
      [],
    );
    expect(
      component('<input type="image" formmethod="post" alt="Go" src="/go.png" />').diagnostics,
    ).toEqual([]);
  });

  it("reports editable content, and accepts an empty editable element", () => {
    expect(only('<div contenteditable="true">x</div>')).toMatchObject({
      code: "UF1002",
      at: "contenteditable",
    });
    expect(attributesOf('<div contenteditable="true"></div>')).toEqual([
      ["contenteditable", "true"],
    ]);
  });
});

describe("class", () => {
  // Vue, Svelte and Angular rewrite a static class this way; the IR holds it so every target
  // writes the same string.
  it.each([
    ['<p class="  b   a\tc  ">x</p>', "b a c"],
    ['<p class="a  c b">x</p>', "a c b"],
    ['<p class="card\n           card--large">x</p>', "card card--large"],
    ['<p class="a\r\nb">x</p>', "a b"],
  ])("lowers %s with one space between names", (jsx, value) => {
    expect(attributesOf(jsx)).toEqual([["class", value]]);
  });

  it("reports an empty class, and the fix removes it", () => {
    const diagnostic = only('<p id="a" class="  ">x</p>');
    expect(diagnostic).toMatchObject({ code: "UF3004", at: "class" });
    expect(applyAndRecheck(diagnostic.source, diagnostic.diagnostics)).toContain('<p id="a">x</p>');
  });

  it("offers no removal that would change which class is set twice", () => {
    const { diagnostics } = component('<p class="" class="a">x</p>');
    expect(codes(diagnostics)).toEqual(["UF3004", "UF3007"]);
    expect(diagnostics.every((diagnostic) => !diagnostic.fixes)).toBe(true);
  });

  it.each([
    '<p class="a\u00a0b">x</p>',
    '<p class="a&#x3000;b">x</p>',
    '<p class="a&#x2028;b">x</p>',
  ])("reports %s, whose whitespace Angular splits names at", (jsx) => {
    expect(only(jsx)).toMatchObject({ code: "UF3008", at: "class" });
  });

  // Angular merges a static class with a spread's through the class list, which drops a repeat
  // the other targets keep, as `class={["a", "a"]}` is reported (UF3007).
  it.each([
    ['<p class="a b a">x</p>', '<p class="a b">x</p>'],
    ['<p class="a  a\n  b">x</p>', '<p class="a b">x</p>'],
    ['<p class={"a a"}>x</p>', '<p class="a">x</p>'],
    ['<p className="a a">x</p>', '<p class="a">x</p>'],
  ])("reports the class named twice in %s, and the fix lists it once", (jsx, fixed) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics).filter((code) => code === "UF3007")).toEqual(["UF3007"]);
    expect(diagnostics.find(({ code }) => code === "UF3007")!.message).toBe(
      "The class `a` is listed twice in this `class`.",
    );
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });

  it("offers no fix for a class named twice whose value another fix edits", () => {
    const { diagnostics } = component('<p class="a&check; a&check;">x</p>');
    expect(codes(diagnostics)).toEqual(["UF3007", "UF3011", "UF3011"]);
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });
});

describe("characters HTML would not keep", () => {
  it("reports a carriage return from a CRLF line ending, and the fix removes it", () => {
    const { source, diagnostics } = component('<p title="a\r\nb">x</p>');
    expect(codes(diagnostics)).toEqual(["UF3010"]);
    expect(slices(source, diagnostics)).toEqual(["\r"]);
    expect(applyAndRecheck(source, diagnostics)).toContain('title="a\nb"');
  });

  it("fixes a lone carriage return to a line feed", () => {
    const { source, diagnostics } = component('<p title="a\rb">x</p>');
    expect(applyAndRecheck(source, diagnostics)).toContain('title="a\nb"');
  });

  it.each([
    ['<p title="a&#13;b">x</p>', "&#13;"],
    ['<p title="a&#0;b">x</p>', "&#0;"],
    ['<p title="a&#1;b">x</p>', "&#1;"],
    ['<p title="a&#x7F;b">x</p>', "&#x7F;"],
    ['<p title="a&#x85;b">x</p>', "&#x85;"],
    ['<p title="a&#xFFFE;b">x</p>', "&#xFFFE;"],
    ['<p title="a&#xFDD0;b">x</p>', "&#xFDD0;"],
    ['<p data-x="a&#x10FFFF;b">x</p>', "&#x10FFFF;"],
  ])("reports %s, without a fix", (jsx, at) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3010"]);
    expect(slices(source, diagnostics)).toEqual([at]);
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });

  it("accepts whitespace and characters HTML keeps", () => {
    expect(attributesOf('<p title="a\n\tb&#12;c&#xA0;&#x1F600;😀&#xFFFD;">x</p>')).toEqual([
      ["title", "a\n\tb\fc\u00a0😀😀\ufffd"],
    ]);
  });
});

describe("references JSX implementations decode differently", () => {
  it.each(['<p title="&#+65;">x</p>', '<p title="&#99999999;">x</p>', '<p title="&#xD800;">x</p>'])(
    "reports %s",
    (jsx) => {
      expect(only(jsx).code).toBe("UF3009");
    },
  );

  it("fixes a surrogate pair to its code point, and still checks the attribute", () => {
    const { source, diagnostics } = component('<p title="&#xD83D;&#xDE00;" TITLE="x">x</p>');
    expect(codes(diagnostics)).toEqual(["UF3009", "UF3007"]);
    expect(applyAndRecheck(source, diagnostics)).toContain('title="&#x1F600;"');
  });
});

describe("the generated-id prefix", () => {
  it.each([
    ['<p id="uf-id-1">a</p>', "uf-id-1"],
    ['<div><label for="uf-id-name">a</label><input id="x" /></div>', "uf-id-name"],
    ['<p aria-describedby="note uf-id-2">a</p>', "uf-id-2"],
    ['<a href="#uf-id-top">a</a>', "uf-id-top"],
  ])("reports %s, which the tests would rename like a generated id", (jsx, id) => {
    expect(only(jsx)).toMatchObject({
      code: "UF3005",
      message: `\`${id}\` is reserved: ids starting with \`uf-id-\` are the ones the compiler generates.`,
    });
  });

  it("accepts ids that only contain the prefix, and the prefix in other attributes", () => {
    expect(
      attributesOf('<p id="my-uf-id-1" title="uf-id-1" aria-describedby="note">a</p>'),
    ).toEqual([
      ["id", "my-uf-id-1"],
      ["title", "uf-id-1"],
      ["aria-describedby", "note"],
    ]);
  });
});

// A name some target's types do not declare fails that target's type-check (L4) whatever its
// value; types-conformance.test.ts checks both lists against the types.
describe("names a target's types do not declare", () => {
  const BOTH = "React's and Vue's element types do not declare";
  const VUE = "Vue's element types do not declare";
  it.each([
    ['<p writingsuggestions="false">a</p>', "writingsuggestions", BOTH],
    ['<button type="button" command="show-modal" commandfor="d">b</button>', "command", BOTH],
    ['<div><input type="text" name="q" dirname="q.dir" /></div>', "dirname", BOTH],
    [
      "<textarea dirname={label}></textarea>",
      "dirname",
      "React's element types do not declare `dirname`, so React's output would not type-check",
    ],
    ['<div><img src="/a.png" alt="" ismap /></div>', "ismap", BOTH],
    ['<map name="m"><area href="/a" alt="a" ping="/p" /></map>', "ping", BOTH],
    [
      '<div popover="auto">a</div>',
      "popover",
      `${VUE} \`popover\` (Vue's are the authoring types)`,
    ],
    ['<dialog closedby="any">a</dialog>', "closedby", VUE],
    ['<button type="button" popovertarget="p">b</button>', "popovertarget", VUE],
    ['<form action="/a" rel="noopener">a</form>', "rel", VUE],
    ['<video><source src="/a.mp4" height="1" /></video>', "height", VUE],
    ['<p aria-description="d">a</p>', "aria-description", "ARIA 1.3 draft"],
    ['<p aria-braillelabel="d">a</p>', "aria-braillelabel", "ARIA 1.3 draft"],
    ['<svg aria-brailleroledescription="d" />', "aria-brailleroledescription", "ARIA 1.3 draft"],
  ])("reports %s (UF1002)", (jsx, name, reason) => {
    const { source, diagnostics } = component(jsx, { props: "label: string" });
    const found = problems(source, diagnostics);
    expect(found[0]).toBe(`UF1002 ${name}`);
    expect(diagnostics[0]!.message).toContain(reason);
    expect(diagnostics[0]!.message).toMatch(/ It lands when they do\.$/);
  });
});

// Names from the source are looked up in tables keyed by name: none may answer from a prototype.
describe("names a prototype has", () => {
  it.each(["constructor", "CONSTRUCTOR", "__proto__", "toString", "valueOf", "hasOwnProperty"])(
    "reports %s as an unknown attribute",
    (name) => {
      expect(only(`<div ${name}="x">a</div>`)).toMatchObject({
        code: "UF3006",
        at: name,
        message: `\`${name}\` is not an attribute of <div>.`,
      });
    },
  );

  it.each(["toString", "constructor", "__proto__"])("reads &%s; as text", (name) => {
    expect(attributesOf(`<p title="&${name};">a</p>`)).toEqual([["title", `&${name};`]]);
  });
});

/** An element where an attribute is accepted, and the markup around it. */
function markupWith(name: string, value: string): string {
  const owner = isHtmlAttribute("div", name) ? "div" : (ownerOf(name) ?? "div");
  const element = `<${owner} ${name}="${value}">a</${owner}>`;
  if (owner === "td") return `<table><tbody><tr>${element}</tr></tbody></table>`;
  if (owner === "input" || owner === "img") return `<div><${owner} ${name}="${value}" /></div>`;
  return `<div>${element}</div>`;
}

describe("the generated-id prefix, wherever the tests would rename it", () => {
  // The one list the normaliser renames ids in: an authored `uf-id-` in any of them would be
  // renamed like a generated one, and could hide a real difference.
  it.each([...ID_REFERENCE_ATTRIBUTES])("reports uf-id- in %s", (name) => {
    const { source, diagnostics } = component(markupWith(name, "note uf-id-x"));
    const owner = ownerOf(name) ?? "div";
    // A name the analyser rejects (`commandfor`, which React's types lack) hides its value.
    const named = isHtmlAttribute(owner, name) ? nameProblem(owner, "html", name, name) : undefined;
    const accepted = isHtmlAttribute(owner, name);
    expect(codes(diagnostics)).toEqual([named?.code ?? (accepted ? "UF3005" : "UF3006")]);
    expect(slices(source, diagnostics)).toEqual([name]);
  });

  it.each([
    ['<a href="#uf-id-x">a</a>', "href"],
    ['<div><img src="#uf-id-x" alt="" /></div>', "src"],
    ['<div><img src="/a.png" alt="" usemap="#uf-id-x" /></div>', "usemap"],
    ['<form action="#uf-id-x"></form>', "action"],
    ['<blockquote cite="#uf-id-x">a</blockquote>', "cite"],
    ['<p title="url(#uf-id-x)">a</p>', "title"],
    ["<p data-mask=\"URL( '#uf-id-x' )\">a</p>", "data-mask"],
    ['<p class="a url(#uf-id-x)">a</p>', "class"],
    ['<p aria-label="fill: url(&#35;uf-id-x)">a</p>', "aria-label"],
  ])("reports the reference in %s", (jsx, name) => {
    expect(only(jsx)).toMatchObject({ code: "UF3005", at: name });
  });

  it("accepts the prefix where nothing refers to an id", () => {
    expect(attributesOf('<a href="/uf-id-x#uf-id-x" title="uf-id-x url(uf-id-x)">a</a>')).toEqual([
      ["href", "/uf-id-x#uf-id-x"],
      ["title", "uf-id-x url(uf-id-x)"],
    ]);
  });
});

describe("fixes", () => {
  // One fix removes the attribute, the other renamed it: their edits overlapped.
  it.each([
    '<div className="">x</div>',
    '<div CLASS="  ">x</div>',
    '<div id="a" className="">x</div>',
  ])("removes the empty class in %s, and does not also rename it", (jsx) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3004"]);
    expect(diagnostics[0]!.message).toContain("This `class` has no class names");
    expect(applyAndRecheck(source, diagnostics)).not.toMatch(/class/i);
  });

  // Every fix of every attribute, alone and beside another, applies with the others and
  // recompiles to exactly the diagnostics that had none, as the harness's L1 requires.
  it("apply together, for every spelling and value of an attribute", () => {
    const names = [
      "class",
      "className",
      "CLASS",
      "id",
      "ID",
      "title",
      "Title",
      "disabled",
      "DISABLED",
      "readOnly",
      "hidden",
      "rows",
      "ROWS",
      "start",
      "href",
      "HREF",
      "download",
      "Download",
      "aria-hidden",
      "ariaHidden",
      "acceptCharset",
      "for",
      "htmlFor",
      "popover",
      "list",
      "type",
      "TYPE",
      "formaction",
    ];
    const values = [null, "", "  ", "03", "disabled", "x", "a  b", "#uf-id-a", "&check;"];
    const elements = ["div", "input", "ol", "a", "textarea", "label", "form", "button"];
    // A neighbour whose problems depend on this attribute: `type` decides whether a submission
    // override is allowed.
    const neighbours = (name: string) => [
      "",
      ` id="b"`,
      ` ${name.toLowerCase()}="y"`,
      ' formaction="/x"',
      ' type="button"',
    ];
    let checked = 0;
    for (const tag of elements) {
      for (const name of names) {
        for (const value of values) {
          const attribute = value === null ? name : `${name}="${value}"`;
          for (const other of neighbours(name)) {
            for (const jsx of [
              `<${tag}${other} ${attribute} />`,
              `<${tag} ${attribute}${other} />`,
            ]) {
              const { source, diagnostics } = component(jsx);
              applyAndRecheck(source, diagnostics);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBe(elements.length * names.length * values.length * 5 * 2);
  }, 60_000);

  // Each element's every attribute written bare, beside each of its other attributes with
  // each of a few values: a fix to one may change what the element makes of another, as
  // `type=""` did for a submit button's overrides (r3-analyzer-2).
  it("for a bare attribute recompile clean beside every other attribute of its element", () => {
    const values = [null, "", "x", "submit", "button", "1", "true"];
    const failures: string[] = [];
    let fixed = 0;
    for (const [tag, own] of ELEMENT_ATTRIBUTES) {
      if (UNRENDERABLE_ELEMENTS.has(tag)) continue;
      const names = [...own, "id", "title", "class", "tabindex", "popover"];
      for (const bare of names) {
        for (const other of names) {
          if (other === bare) continue;
          for (const value of isBooleanAttribute(other) ? [null] : values) {
            const attributes = `${bare} ${value === null ? other : `${other}="${value}"`}`;
            const element = VOID_ELEMENTS.has(tag)
              ? `<${tag} ${attributes} />`
              : `<${tag} ${attributes}>t</${tag}>`;
            const { source, diagnostics } = component(inParents(tag, element));
            if (!diagnostics.some((diagnostic) => diagnostic.fixes?.length)) continue;
            try {
              applyAndRecheck(source, diagnostics);
              fixed++;
            } catch (error) {
              failures.push((error as Error).message);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
    expect(fixed).toBeGreaterThan(5_000);
  }, 60_000);

  it.each([
    ['<a href="/f" download>a</a>', '<a href="/f" download="">a</a>'],
    ["<p translate>a</p>", '<p translate="yes">a</p>'],
    ['<img src="/a.png" alt crossorigin />', '<img src="/a.png" alt="" crossorigin="" />'],
    ['<a href="/f" DOWNLOAD>a</a>', '<a href="/f" download="">a</a>'],
  ])("writes the empty value HTML reads a bare attribute as, in %s", (jsx, fixed) => {
    const { source, diagnostics } = component(jsx);
    expect(diagnostics.every((diagnostic) => diagnostic.fixes?.length)).toBe(true);
    expect(
      diagnostics.find((diagnostic) => diagnostic.message.includes("needs a value"))!.fixes,
    ).toEqual([expect.objectContaining({ confidence: "likely" })]);
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });

  it.each(['<div><img src alt="" /></div>', "<p class>a</p>", "<textarea rows></textarea>"])(
    "offers no empty value the compiler would reject, in %s",
    (jsx) => {
      expect(only(jsx).fixes).toBeUndefined();
    },
  );
});

/** An element inside the parents HTML requires it to have. */
function inParents(tag: string, element: string): string {
  const parent: Readonly<Record<string, string>> = {
    area: '<map name="m">',
    col: "<table><colgroup>",
    colgroup: "<table>",
    li: "<ul>",
    optgroup: "<select>",
    option: "<select>",
    td: "<table><tbody><tr>",
    th: "<table><tbody><tr>",
  };
  const opening =
    parent[tag] ?? (REQUIRED_PARENTS.has(tag) ? `<${[...REQUIRED_PARENTS.get(tag)!][0]}>` : "");
  const closing = [...opening.matchAll(/<([a-z]+)/g)]
    .map((match) => `</${match[1]}>`)
    .toReversed()
    .join("");
  return `${opening}${element}${closing}`;
}

describe("React's spellings and other vocabularies", () => {
  it.each([['<form acceptCharset="utf-8"></form>', "acceptCharset", "accept-charset"]])(
    "renames %s",
    (jsx, written, html) => {
      const diagnostic = only(jsx);
      expect(diagnostic).toMatchObject({
        code: "UF3004",
        at: written,
        fixes: [{ confidence: "safe", title: `Rename \`${written}\` to \`${html}\`` }],
      });
      expect(applyAndRecheck(diagnostic.source, diagnostic.diagnostics)).toContain(`${html}="`);
    },
  );

  it("accepts HTML Media Capture's capture on an input", () => {
    expect(attributesOf('<input type="file" accept="image/*" capture="user" />')).toEqual([
      ["type", "file"],
      ["accept", "image/*"],
      ["capture", "user"],
    ]);
  });
});

describe("muted", () => {
  // Not form state: React and Vue set the property, and render no attribute in the browser.
  it.each([
    [
      "<video muted></video>",
      "muted",
      "`muted` on <video> is not supported yet: React and Vue set `muted` as the media element's property",
    ],
    ["<audio muted></audio>", "muted", "`muted` on <audio> is not supported yet"],
    [
      "<audio defaultMuted></audio>",
      "defaultMuted",
      "`defaultMuted` is the DOM property of the `muted` attribute.",
    ],
  ])("reports %s without promising v-model", (jsx, name, message) => {
    const diagnostic = only(jsx);
    expect(diagnostic).toMatchObject({ code: "UF1002", at: name });
    expect(diagnostic.message).toContain(message);
    expect(diagnostic.message).not.toContain("v-model");
  });
});
