import { cssPropertiesOverlap, ID_REFERENCE_ATTRIBUTES } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { normalizeHtml } from "../src/normalize/index.ts";
import { printTree } from "../src/normalize/print.ts";
import { isAngularHost, unwrapAngularHosts } from "../src/normalize/rules/angular-hosts.ts";
import { removeComments } from "../src/normalize/rules/comments.ts";
import { removeSettledValues } from "../src/normalize/rules/control-values.ts";
import {
  isFrameworkAttribute,
  removeFrameworkAttributes,
} from "../src/normalize/rules/framework-attributes.ts";
import { canonicalizeGeneratedIds } from "../src/normalize/rules/generated-ids.ts";
import { canonicalizeClasses, sortAttributes } from "../src/normalize/rules/ordering.ts";
import { removeQwikTemplates } from "../src/normalize/rules/qwik-templates.ts";
import {
  canonicalizeBooleanAttributes,
  canonicalizeStyles,
} from "../src/normalize/rules/values.ts";
import { NORMALIZE_TARGETS } from "../src/normalize/targets.ts";
import { forEachElement, parseHtml } from "../src/normalize/tree.ts";
import type { TreeElement, TreeFragment } from "../src/normalize/tree.ts";

/** Parses, applies only the given rules, and prints: each rule tested on its own. */
function apply(html: string, ...rules: ((root: TreeFragment) => void)[]): string {
  const root = parseHtml(html);
  for (const rule of rules) rule(root);
  return printTree(root);
}

/** Every element of a fragment, in document order. */
function elements(html: string): TreeElement[] {
  const found: TreeElement[] = [];
  forEachElement(parseHtml(html), (element) => found.push(element));
  return found;
}

describe("rule 1: removeComments", () => {
  it.each([
    ["Vue v-if", "<p>a</p><!--v-if-->"],
    ["Vue and Svelte fragments", "<!--[--><p>a</p><!--]-->"],
    ["Svelte empty anchors", "<p>a</p><!---->"],
    ["Angular containers", "<!--container--><p>a</p><!--container-->"],
    ["Angular hydration markers", "<!--nghm--><p>a</p>"],
    ["Qwik virtual nodes", "<!--qv q:key=a q:id=1--><p>a</p><!--/qv-->"],
  ])("removes %s", (_, html) => {
    expect(apply(html, removeComments)).toBe('<p>\n  "a"\n</p>\n');
  });

  it("joins the text around React and Solid anchors into one text", () => {
    const expected = '<p>\n  "Hello, world!"\n</p>\n';
    expect(apply("<p>Hello, <!-- -->world<!-- -->!</p>", removeComments)).toBe(expected);
    expect(apply("<p>Hello, <!--$-->world<!--/-->!</p>", removeComments)).toBe(expected);
  });

  it("removes comments at every depth, including template content", () => {
    expect(
      apply(
        "<div><!--a--><span><!--b-->x</span><template><!--c--><i></i></template></div>",
        removeComments,
      ),
    ).toBe(
      [
        "<div>",
        "  <span>",
        '    "x"',
        "  </span>",
        "  <template>",
        "    <i></i>",
        "  </template>",
        "</div>",
        "",
      ].join("\n"),
    );
  });

  it("does not touch the text on either side of a comment", () => {
    expect(normalizeHtml("<p>Hello, <!-- -->world</p>")).not.toBe(
      normalizeHtml("<p>Hello,<!-- -->world</p>"),
    );
  });

  it("keeps text and attribute values that only look like comments", () => {
    expect(apply('<p title="<!-- t -->">&lt;!-- x --&gt;</p>', removeComments)).toBe(
      '<p title="<!-- t -->">\n  "<!-- x -->"\n</p>\n',
    );
  });
});

describe("rule 2: removeFrameworkAttributes", () => {
  it.each([
    [
      "Angular emulated encapsulation",
      "angular",
      '<p _nghost-ng-c3792917614="" _ngcontent-ng-c3792917614="">a</p>',
    ],
    ["Angular dev-mode reflection", "angular", '<p ng-reflect-name="x">a</p>'],
    [
      "Angular root markers",
      "angular",
      '<p ng-version="22.2.1" ng-server-context="other" ngh="0">a</p>',
    ],
    ["Qwik 2 element data", "qwik", '<p q:key="a" q:p="0" q:container="resumed" :="ii_0">a</p>'],
    ["Qwik 2 events", "qwik", '<p q-e:click="mock-chunk#_run#1" q-d:q-hmr="" q-w:resize="x">a</p>'],
    [
      "Qwik 2 passive listeners",
      "qwik",
      '<p q-ep:wheel="mock-chunk#_run#8" q-dp:touchmove="x" q-wp:scroll="y">a</p>',
    ],
    ["Qwik 1 listeners", "qwik", '<p on:click="x" on-document:load="y" on-window:resize="z">a</p>'],
    [
      "Qwik 2 listener options its loader reads at dispatch",
      "qwik",
      '<p preventdefault:submit="" stoppropagation:click="" capture:click="">a</p>',
    ],
    ["Solid hydration keys", "solid", '<p data-hk="00">a</p>'],
    [
      "Astro scope hashes, bare or empty",
      "astro",
      '<p data-astro-cid-c7yaimas data-astro-cid-x="">a</p>',
    ],
    [
      "Astro dev-toolbar sources",
      "astro",
      '<p data-astro-source-file="/a.astro" data-astro-source-loc="9:21">a</p>',
    ],
  ] as const)("removes %s from that target's output", (_, target, html) => {
    expect(apply(html, (root) => removeFrameworkAttributes(root, target))).toBe(
      '<p>\n  "a"\n</p>\n',
    );
  });

  it("removes them on every element, at every depth", () => {
    expect(
      apply('<section :="6X_0"><h2 :="">T</h2><br :=""></section>', (root) =>
        removeFrameworkAttributes(root, "qwik"),
      ),
    ).toBe('<section>\n  <h2>\n    "T"\n  </h2>\n  <br>\n</section>\n');
  });

  it("keeps another framework's noise: in this target's output it is an attribute it rendered", () => {
    const html = '<p data-hk="1" ng-version="1" ngh="0" q:key="a" data-astro-cid-x="">x</p>';
    for (const target of ["react", "vue", "svelte"] as const) {
      expect(apply(html, (root) => removeFrameworkAttributes(root, target))).toBe(apply(html));
    }
    expect(apply(html, (root) => removeFrameworkAttributes(root, "solid"))).not.toContain(
      "data-hk",
    );
    expect(apply(html, (root) => removeFrameworkAttributes(root, "solid"))).toContain("ng-version");
    expect(normalizeHtml(html, { target: "vue" })).not.toBe(
      normalizeHtml("<p>x</p>", { target: "vue" }),
    );
  });

  it("removes nothing without a target: no framework is known", () => {
    const html = '<p _ngcontent-ng-c1="" data-hk="0" q:key="a">x</p>';
    expect(apply(html, (root) => removeFrameworkAttributes(root))).toBe(apply(html));
  });

  it.each([
    "data-uf-c3a1",
    "uf:value",
    "uf:checked",
    "class",
    "data-testid",
    "aria-label",
    "onclick",
    "data-hk-x",
    "data-hkey",
    "nghost",
    "ngh-x",
    "ng-click",
    "q",
    "qa:x",
    "q-ex:click",
    "data-astro",
    "data-q",
    "x-on:click",
  ])("keeps the authored or compiler attribute %s on every target", (name) => {
    for (const target of NORMALIZE_TARGETS) {
      expect(isFrameworkAttribute(name, target)).toBe(false);
    }
  });

  it("does not erase a difference in a compiler scope attribute", () => {
    expect(normalizeHtml('<p data-uf-c3a1 class="a">x</p>', { target: "angular" })).not.toBe(
      normalizeHtml('<p class="a">x</p>', { target: "angular" }),
    );
  });
});

describe("rule 2b: removeQwikTemplates", () => {
  // Qwik 2's server render of a slot whose fallback a consumer's content replaced (ADR-0058).
  const html =
    '<section><p>Ada</p><q:template aria-hidden="true" hidden=""><span>No details</span></q:template></section>';

  it("removes Qwik's q:template elements and their content", () => {
    expect(apply(html, (root) => removeQwikTemplates(root, "qwik"))).toBe(
      '<section>\n  <p>\n    "Ada"\n  </p>\n</section>\n',
    );
    expect(normalizeHtml(html, { target: "qwik" })).toBe(
      normalizeHtml("<section><p>Ada</p></section>", { target: "qwik" }),
    );
  });

  it("keeps the element on every other target, and without a target", () => {
    for (const target of NORMALIZE_TARGETS.filter((each) => each !== "qwik")) {
      expect(normalizeHtml(html, { target })).toContain("<q:template");
    }
    expect(apply(html, (root) => removeQwikTemplates(root))).toBe(apply(html));
  });

  it("keeps a template of any other name on Qwik", () => {
    const template = "<section><template><p>t</p></template><q:slot>s</q:slot></section>";
    expect(apply(template, (root) => removeQwikTemplates(root, "qwik"))).toBe(apply(template));
  });
});

describe("rule 4d: removeSettledValues", () => {
  it("removes an input's value attribute that equals its uf:value", () => {
    expect(apply('<input uf:value="hi" value="hi">', removeSettledValues)).toBe(
      '<input uf:value="hi">\n',
    );
    expect(apply('<input uf:value="" value="">', removeSettledValues)).toBe(
      '<input uf:value="">\n',
    );
    // React's controlled input against Vue's v-model, on every target (ADR-0058).
    for (const target of NORMALIZE_TARGETS) {
      expect(normalizeHtml('<input uf:value="hi" value="hi">', { target })).toBe(
        normalizeHtml('<input uf:value="hi">', { target }),
      );
    }
  });

  it("keeps a value attribute that differs from the input's value", () => {
    const typed = '<input uf:value="y" value="x">';
    expect(apply(typed, removeSettledValues)).toBe(apply(typed));
    expect(normalizeHtml(typed, { target: "react" })).not.toBe(
      normalizeHtml('<input uf:value="y">', { target: "react" }),
    );
  });

  it("keeps a value attribute where no uf:value holds the state", () => {
    const html =
      '<input value="x"><input type="checkbox" value="x" uf:checked="true"><button value="x">b</button><option value="x" uf:selected="true">o</option>';
    expect(apply(html, removeSettledValues)).toBe(apply(html));
  });

  it("keeps the value attribute of an element that is not an input", () => {
    const html = '<data uf:value="x" value="x">d</data>';
    expect(apply(html, removeSettledValues)).toBe(apply(html));
  });
});

describe("rule 3: unwrapAngularHosts", () => {
  const angular = (root: TreeFragment) => unwrapAngularHosts(root, "angular");

  it("replaces a display: contents host with its children", () => {
    expect(
      apply(
        '<uf-hello style="display: contents;"><p class="greeting">Hello</p></uf-hello>',
        angular,
      ),
    ).toBe('<p class="greeting">\n  "Hello"\n</p>\n');
  });

  it("unwraps a styled component's host, whose only other attributes are Angular's", () => {
    expect(
      apply(
        '<uf-card _nghost-ng-c1="" ng-version="22.2.1" style="display:contents"><p _ngcontent-ng-c1="">a</p></uf-card>',
        angular,
      ),
    ).toBe('<p _ngcontent-ng-c1="">\n  "a"\n</p>\n');
  });

  it("unwraps nested hosts, and joins the text they separated", () => {
    expect(
      apply(
        '<div>a<uf-outer style="display: contents">b<uf-inner style="display: contents">c</uf-inner></uf-outer></div>',
        angular,
      ),
    ).toBe('<div>\n  "abc"\n</div>\n');
  });

  it.each([
    ["an authored attribute", '<uf-x class="fallthrough" style="display: contents"></uf-x>'],
    ["another declaration", '<uf-x style="display: contents; color: red"></uf-x>'],
    ["another display", '<uf-x style="display: block"></uf-x>'],
    ["no style", "<uf-x></uf-x>"],
    ["a non-uf tag", '<app-x style="display: contents"></app-x>'],
  ])("keeps a host with %s, so the difference it makes stays visible", (_, html) => {
    expect(isAngularHost(elements(html)[0]!)).toBe(false);
    expect(apply(html, angular)).toBe(apply(html));
  });

  it("does not erase a fallthrough attribute left on the host", () => {
    expect(
      normalizeHtml('<uf-x class="a" style="display: contents"><p>x</p></uf-x>', {
        target: "angular",
      }),
    ).not.toBe(normalizeHtml("<p>x</p>", { target: "angular" }));
  });

  it("keeps a contents wrapper in any other target's output, or without a target", () => {
    const html = '<uf-hello style="display: contents"><p>x</p></uf-hello>';
    for (const target of ["react", "vue", "svelte", "solid", "qwik", "astro", undefined] as const) {
      expect(apply(html, (root) => unwrapAngularHosts(root, target))).toBe(apply(html));
    }
    expect(normalizeHtml(html, { target: "react" })).not.toBe(
      normalizeHtml("<p>x</p>", { target: "react" }),
    );
  });
});

describe("rule 5: sortAttributes", () => {
  it("sorts attributes by name, by code units", () => {
    expect(
      apply(
        '<p title="t" class="c" aria-label="a" id="i" data-b="b" data-a="a" B="x">x</p>',
        sortAttributes,
      ),
    ).toBe(
      '<p aria-label="a" b="x" class="c" data-a="a" data-b="b" id="i" title="t">\n  "x"\n</p>\n',
    );
  });

  it("sorts at every depth", () => {
    expect(apply('<div z="1" a="2"><i y="1" b="2"></i></div>', sortAttributes)).toBe(
      '<div a="2" z="1">\n  <i b="2" y="1"></i>\n</div>\n',
    );
  });

  it("does not erase a difference in a value", () => {
    expect(normalizeHtml('<p a="1" b="2"></p>')).not.toBe(normalizeHtml('<p b="1" a="2"></p>'));
    expect(normalizeHtml('<p a="1" b="2"></p>')).toBe(normalizeHtml('<p b="2" a="1"></p>'));
  });
});

describe("rule 4c: canonicalizeClasses", () => {
  it("sorts class tokens and collapses the whitespace between them", () => {
    expect(apply('<p class="  card\n is-active\tb a "></p>', canonicalizeClasses)).toBe(
      '<p class="a b card is-active"></p>\n',
    );
  });

  it("does not erase a different or a duplicated class", () => {
    expect(normalizeHtml('<p class="a b"></p>')).not.toBe(normalizeHtml('<p class="a c"></p>'));
    expect(normalizeHtml('<p class="a a"></p>')).not.toBe(normalizeHtml('<p class="a"></p>'));
  });

  // ADR-0044: Vue's server writes class="" where its client writes nothing, Svelte's client the
  // other way round, and Chromium keeps class="" once the last token is toggled off.
  it("removes a class with no token, which applies no class", () => {
    expect(apply('<p class=""></p><p class=" \t "></p>', canonicalizeClasses)).toBe(
      "<p></p>\n<p></p>\n",
    );
    expect(normalizeHtml('<p class=""></p>')).toBe(normalizeHtml("<p></p>"));
  });

  it("does not erase a class with a token", () => {
    expect(normalizeHtml('<p class="a"></p>')).not.toBe(normalizeHtml("<p></p>"));
    expect(normalizeHtml('<p class=" a "></p>')).not.toBe(normalizeHtml('<p class=""></p>'));
  });

  it("leaves other attributes' tokens in order", () => {
    expect(apply('<p aria-describedby="b a"></p>', canonicalizeClasses)).toBe(
      '<p aria-describedby="b a"></p>\n',
    );
  });
});

// The ordering guard of rule 4a is `@unframework/ir`'s: these are the pairs the normaliser relies on.
describe("cssPropertiesOverlap: whether two declarations' order decides what renders", () => {
  it.each([
    ["color", "color"],
    ["margin", "margin-top"],
    ["margin-top", "margin"],
    ["border", "border-top-color"],
    ["border-color", "border-top"],
    ["font", "line-height"],
    ["white-space", "text-wrap-mode"],
    ["all", "color"],
    ["margin-inline-start", "margin-left"],
    ["margin-right", "margin-inline"],
    ["border-block-start-width", "border-width"],
    ["border-end-start-radius", "border-bottom-left-radius"],
    ["max-block-size", "max-height"],
    ["overflow-inline", "overflow"],
    ["inset", "inset-inline-end"],
  ])("%s and %s", (a, b) => {
    expect(cssPropertiesOverlap(a, b)).toBe(true);
    expect(cssPropertiesOverlap(b, a)).toBe(true);
  });

  it.each([
    ["color", "background-color"],
    ["margin-top", "margin-left"],
    ["margin-top", "padding-top"],
    ["border-top-width", "border-top-color"],
    ["margin-inline-start", "margin-block-start"],
    ["margin-inline-start", "padding-left"],
    ["width", "height"],
    ["min-width", "width"],
    ["all", "--gap"],
    ["all", "direction"],
    ["--gap", "--Gap"],
  ])("not %s and %s", (a, b) => {
    expect(cssPropertiesOverlap(a, b)).toBe(false);
    expect(cssPropertiesOverlap(b, a)).toBe(false);
  });
});

describe("rule 4a: canonicalizeStyles", () => {
  it.each([
    ["spacing and case", "COLOR:red;margin-top : 1px ;", "color: red; margin-top: 1px;"],
    ["comments", "color: /* brand */ red; /* gone */", "color: red;"],
    ["!important", "color:red ! IMPORTANT", "color: red !important;"],
    [
      "an overridden declaration, kept",
      "color: red; margin: 0; color: blue",
      "color: red; margin: 0; color: blue;",
    ],
    [
      "an !important declaration, kept with the later one",
      "color: red !important; color: blue",
      "color: red !important; color: blue;",
    ],
    ["strings, kept exactly", 'font-family: "A  ;B" ,  serif', 'font-family: "A  ;B" , serif;'],
    [
      "a semicolon inside url()",
      "background: url(data:image/png;base64,AA)",
      "background: url(data:image/png;base64,AA);",
    ],
    ["custom properties, case kept", "--Accent : Red", "--Accent: Red;"],
    ["a chunk without a colon, kept", "color: red; oops", "color: red; oops;"],
    [
      "unrelated declarations, sorted",
      "margin-top: 1px; color: red",
      "color: red; margin-top: 1px;",
    ],
    ["custom properties, sorted first", "color: red; --gap: 2px", "--gap: 2px; color: red;"],
    ["an empty value, dropped", "color: ; margin: 0", "margin: 0;"],
    ["an empty !important value, dropped", "color: !important; margin: 0", "margin: 0;"],
  ])("canonicalises %s", (_, style, expected) => {
    expect(apply(`<p style='${style}'></p>`, canonicalizeStyles)).toBe(
      `<p style=${JSON.stringify(expected)}></p>\n`,
    );
  });

  // ADR-0044: Vue's server writes style="" (and `color:;` for an empty bound value) where its
  // client writes nothing; the CSSOM ignores an empty value.
  it.each([
    ["no declaration", ""],
    ["an empty declaration list", " ; "],
    ["only empty values", "color: ; margin:"],
  ])("removes a style with %s, which declares nothing", (_, style) => {
    expect(apply(`<p style='${style}'></p>`, canonicalizeStyles)).toBe("<p></p>\n");
  });

  it("does not erase a declaration with a value, or a chunk without a colon", () => {
    expect(normalizeHtml('<p style="color: red"></p>')).not.toBe(normalizeHtml("<p></p>"));
    expect(normalizeHtml('<p style="color: red"></p>')).not.toBe(
      normalizeHtml('<p style="color: "></p>'),
    );
    expect(normalizeHtml('<p style="oops"></p>')).not.toBe(normalizeHtml("<p></p>"));
  });

  it("sorts declarations whose order cannot change what renders", () => {
    expect(normalizeHtml('<p style="margin-top: 4px; color: red"></p>')).toBe(
      normalizeHtml('<p style="color: red; margin-top: 4px"></p>'),
    );
    // Two sides of one shorthand, and two longhands of different shorthands.
    expect(normalizeHtml('<p style="margin-top: 4px; margin-left: 2px"></p>')).toBe(
      normalizeHtml('<p style="margin-left: 2px; margin-top: 4px"></p>'),
    );
    expect(normalizeHtml('<p style="border-top-width: 1px; margin-top: 2px"></p>')).toBe(
      normalizeHtml('<p style="margin-top: 2px; border-top-width: 1px"></p>'),
    );
    // `all` resets no custom property.
    expect(normalizeHtml('<p style="all: initial; --gap: 1px"></p>')).toBe(
      normalizeHtml('<p style="--gap: 1px; all: initial"></p>'),
    );
  });

  it("matches what the CSSOM serialises", () => {
    expect(apply('<uf-x style="display:contents"></uf-x>', canonicalizeStyles)).toBe(
      apply('<uf-x style="display: contents;"></uf-x>'),
    );
  });

  it("keeps declaration order, which shorthands make significant", () => {
    expect(normalizeHtml('<p style="margin: 0; margin-top: 1px"></p>')).not.toBe(
      normalizeHtml('<p style="margin-top: 1px; margin: 0"></p>'),
    );
  });

  it.each([
    ["the same property twice", "color: red", "color: blue"],
    ["a shorthand and its longhand", "margin: 0", "margin-top: 4px"],
    ["two shorthands that share a longhand", "border-width: 2px", "border-top: 1px solid"],
    ["`all` and a standard property", "all: initial", "color: red"],
    ["a flow-relative longhand and a physical one", "margin-inline-start: 1px", "margin-left: 2px"],
    ["a flow-relative shorthand and a physical one", "padding-block: 1px", "padding: 2px"],
    [
      "a flow-relative corner and a physical one",
      "border-start-end-radius: 1px",
      "border-radius: 2px",
    ],
    ["a flow-relative size and a physical one", "inline-size: 1px", "width: 2px"],
    ["a flow-relative inset and a physical one", "inset-block-end: 1px", "bottom: 2px"],
  ])("keeps the order of %s, and every other declaration's", (_, first, second) => {
    // An unrelated declaration first, which sorting would move to the end.
    const style = (a: string, b: string) => normalizeHtml(`<p style="z-index: 1; ${a}; ${b}"></p>`);
    expect(style(first, second)).not.toBe(style(second, first));
    expect(style(first, second)).toContain(`z-index: 1; ${first}; ${second};`);
  });

  it("does not erase a fallback that a later declaration the browser rejects leaves in place", () => {
    // Chromium renders the first red: `nonsense` is dropped when the style is parsed.
    expect(normalizeHtml('<p style="color: red; color: nonsense"></p>')).not.toBe(
      normalizeHtml('<p style="color: nonsense"></p>'),
    );
    expect(normalizeHtml('<p style="color: red; color: nonsense"></p>')).not.toBe(
      normalizeHtml('<p style="color: blue; color: nonsense"></p>'),
    );
  });

  it("does not interpret values", () => {
    expect(normalizeHtml('<p style="margin: 0"></p>')).not.toBe(
      normalizeHtml('<p style="margin: 0px"></p>'),
    );
    expect(normalizeHtml('<p style="color: red"></p>')).not.toBe(
      normalizeHtml('<p style="color: blue"></p>'),
    );
  });
});

describe("rule 4b: canonicalizeBooleanAttributes", () => {
  it.each([
    ['<input disabled="disabled">', '<input disabled="">'],
    ['<input disabled="DISABLED">', '<input disabled="">'],
    ["<input disabled>", '<input disabled="">'],
    [
      '<input checked="checked" required="required" readonly="readonly">',
      '<input checked="" required="" readonly="">',
    ],
    ['<option selected="selected"></option>', '<option selected=""></option>'],
    ['<details open="open"></details>', '<details open=""></details>'],
    ['<div hidden="hidden"></div>', '<div hidden=""></div>'],
    [
      '<video muted="muted" playsinline="playsinline"></video>',
      '<video muted="" playsinline=""></video>',
    ],
  ])("writes %s as an empty value", (html, expected) => {
    expect(apply(html, canonicalizeBooleanAttributes)).toBe(`${expected}\n`);
  });

  it.each([
    ["an invalid value", '<input disabled="false">'],
    ["hidden=until-found, a state of its own", '<div hidden="until-found"></div>'],
    [
      "an attribute that is not boolean on this element",
      '<div open="open" selected="selected"></div>',
    ],
    ["an element outside HTML", '<svg><rect disabled="disabled"></rect></svg>'],
  ])("keeps %s", (_, html) => {
    expect(apply(html, canonicalizeBooleanAttributes)).toBe(apply(html));
  });

  it("does not erase the difference between present, absent and invalid", () => {
    expect(normalizeHtml("<input disabled>")).not.toBe(normalizeHtml("<input>"));
    expect(normalizeHtml('<input disabled="false">')).not.toBe(normalizeHtml("<input disabled>"));
  });

  // Qwik 2.0 beta's client: `<input disabled readOnly required={on} />` renders
  // `disabled="true" readonly="true" required=""`, where its server and Vue write them empty.
  it.each([
    [
      '<input disabled="true" readonly="TRUE" required="">',
      '<input disabled="" readonly="" required="">',
    ],
    ['<details open="true"></details>', '<details open=""></details>'],
    ['<div hidden="true"></div>', '<div hidden=""></div>'],
  ])("writes Qwik's %s as an empty value", (html, expected) => {
    const root = parseHtml(html);
    canonicalizeBooleanAttributes(root, "qwik");
    expect(printTree(root)).toBe(`${expected}\n`);
    expect(normalizeHtml(html, { target: "qwik" })).toBe(
      normalizeHtml(expected, { target: "vue" }),
    );
  });

  it('keeps "true" from every other target, and "false" and until-found from Qwik', () => {
    for (const target of NORMALIZE_TARGETS.filter((name) => name !== "qwik")) {
      expect(normalizeHtml('<input disabled="true">', { target })).not.toBe(
        normalizeHtml("<input disabled>", { target }),
      );
    }
    expect(normalizeHtml('<input disabled="true">')).not.toBe(normalizeHtml("<input disabled>"));
    for (const html of ['<input disabled="false">', '<div hidden="until-found"></div>']) {
      expect(normalizeHtml(html, { target: "qwik" })).toBe(normalizeHtml(html));
    }
    // Not a boolean attribute on this element, or outside HTML: kept on Qwik too.
    for (const html of ['<div open="true"></div>', '<svg><rect hidden="true"></rect></svg>']) {
      expect(normalizeHtml(html, { target: "qwik" })).toBe(normalizeHtml(html));
    }
  });
});

describe("rule 7: canonicalizeGeneratedIds", () => {
  const canonicalize = (root: TreeFragment) => canonicalizeGeneratedIds(root);

  it("renames the compiler's ids and every reference to them, in order of appearance", () => {
    const html =
      '<label for="uf-id-x7">A</label><input id="uf-id-x7" aria-describedby="uf-id-0 help"><span id="uf-id-0">h</span>';
    expect(apply(html, canonicalize)).toBe(
      [
        '<label for="uf-id-1">',
        '  "A"',
        "</label>",
        '<input id="uf-id-1" aria-describedby="uf-id-2 help">',
        '<span id="uf-id-2">',
        '  "h"',
        "</span>",
        "",
      ].join("\n"),
    );
  });

  it("returns its renaming, filling in a map it is given", () => {
    const ids = new Map<string, string>();
    const root = parseHtml(
      '<label for="uf-id-b">B</label><input id="uf-id-b"><p id="uf-id-a"></p>',
    );
    expect(canonicalizeGeneratedIds(root, ids)).toBe(ids);
    expect([...ids]).toEqual([
      ["uf-id-b", "uf-id-1"],
      ["uf-id-a", "uf-id-2"],
    ]);
  });

  it("renames ids in every idref attribute", () => {
    const html =
      '<table><tbody><tr><td headers="uf-id-a uf-id-b"></td></tr></tbody></table><input list="uf-id-c" form="uf-id-d"><button popovertarget="uf-id-e" commandfor="uf-id-f" interestfor="uf-id-p"></button>' +
      '<div aria-activedescendant="uf-id-g" aria-controls="uf-id-h" aria-details="uf-id-i" aria-errormessage="uf-id-j" aria-flowto="uf-id-k" aria-labelledby="uf-id-l" aria-owns="uf-id-m" aria-actions="uf-id-n" itemref="uf-id-o"></div>';
    const out = apply(html, canonicalize);
    expect(out).not.toMatch(/uf-id-[a-z]/);
    expect(out.match(/uf-id-\d+/g)).toHaveLength(16);
  });

  it("reads references from the list in which the analyzer reserves the prefix", () => {
    // One list (`@unframework/ir`): an attribute the analyzer lets through with an authored
    // `uf-id-…` value would be renamed here, erasing a real difference.
    for (const name of ID_REFERENCE_ATTRIBUTES) {
      const html = `<p ${name}="uf-id-q"></p>`;
      expect(apply(html, canonicalize), name).toBe(`<p ${name}="uf-id-1"></p>\n`);
    }
  });

  it("recognises a generated id by its prefix alone, whatever the framework's id looks like", () => {
    // React 19.2 and later write `_R_1_` on the server and `_r_1_` on the client.
    expect(
      apply('<p id="uf-id-_R_1_"></p><p aria-labelledby="uf-id-_r_a_"></p>', canonicalize),
    ).toBe('<p id="uf-id-1"></p>\n<p aria-labelledby="uf-id-2"></p>\n');
  });

  it("renames a #fragment URL and url(#…) the same way, so a skip link or paint reference stays consistent", () => {
    const html =
      '<a href="#uf-id-main">Skip</a><svg><use xlink:href="#uf-id-icon"></use><rect fill="url(#uf-id-grad)" style="mask: url(\'#uf-id-icon\')"></rect></svg><main id="uf-id-main"></main>';
    expect(apply(html, canonicalize)).toBe(
      [
        '<a href="#uf-id-1">',
        '  "Skip"',
        "</a>",
        "<svg>",
        '  <use xlink:href="#uf-id-2"></use>',
        '  <rect fill="url(#uf-id-3)" style="mask: url(\'#uf-id-2\')"></rect>',
        "</svg>",
        '<main id="uf-id-1"></main>',
        "",
      ].join("\n"),
    );
  });

  it("numbers ids in the order sortAttributes leaves, so a framework's attribute order does not matter", () => {
    expect(normalizeHtml('<p id="uf-id-b" aria-describedby="uf-id-a"></p>')).toBe(
      normalizeHtml('<p aria-describedby="uf-id-a" id="uf-id-b"></p>'),
    );
  });

  it.each([
    "profile-name",
    "email",
    "title",
    "main",
    "s1",
    "c2",
    "cl-1",
    "00",
    "0a10",
    "_r_0_",
    "_R_5H1_",
    "v-0",
    "B2t0",
    "uf-idx",
  ])("never renames the authored id %s, on any target", (id) => {
    const html = `<label for="${id}"></label><input id="${id}"><a href="#${id}"></a>`;
    for (const target of [...NORMALIZE_TARGETS, undefined]) {
      expect(normalizeHtml(html, target ? { target } : {})).toBe(normalizeHtml(html));
      expect(normalizeHtml(html)).toContain(`id="${id}"`);
    }
  });

  it("does not equate two authored ids that only look generated", () => {
    expect(normalizeHtml('<h2 id="s1">A</h2>', { target: "svelte" })).not.toBe(
      normalizeHtml('<h2 id="s2">A</h2>', { target: "svelte" }),
    );
  });

  it("renames a generated id in every attribute value and text node, in document order", () => {
    // A radio group's name, a data-* value, a title, text, and a URL to another page: wherever a
    // generated id appears, it is the framework's noise (ADR-0049).
    const html =
      '<fieldset data-group="uf-id-v-7"><legend title="see #uf-id-v-3">Size uf-id-v-3.</legend>' +
      '<input type="radio" name="uf-id-v-7" value="s"><a href="/page#uf-id-v-3">More</a>' +
      '<p style="background: url(/a.png#uf-id-v-3)">(uf-id-v-9)</p></fieldset>';
    expect(apply(html, canonicalize)).toBe(
      [
        '<fieldset data-group="uf-id-1">',
        '  <legend title="see #uf-id-2">',
        '    "Size uf-id-2."',
        "  </legend>",
        '  <input type="radio" name="uf-id-1" value="s">',
        '  <a href="/page#uf-id-2">',
        '    "More"',
        "  </a>",
        '  <p style="background: url(/a.png#uf-id-2)">',
        '    "(uf-id-3)"',
        "  </p>",
        "</fieldset>",
        "",
      ].join("\n"),
    );
  });

  it("ends an id where an id character stops, and reads a suffixed id as another id", () => {
    // `${base}-${index}` beside a second id: three ids, each numbered on its own.
    expect(
      apply(
        '<p id="uf-id-v-1">uf-id-v-1, uf-id-v-0-0;uf-id-v-0-1</p><b>xuf-id-v-1 a-uf-id-v-1</b>',
        canonicalize,
      ),
    ).toBe(
      [
        '<p id="uf-id-1">',
        '  "uf-id-1, uf-id-2;uf-id-3"',
        "</p>",
        "<b>",
        '  "xuf-id-v-1 a-uf-id-v-1"',
        "</b>",
        "",
      ].join("\n"),
    );
  });

  it("sorts a class's tokens again once its ids are renamed", () => {
    // The tokens were sorted by their raw ids; the ids were numbered in the document's order.
    expect(
      apply('<i id="uf-id-z"></i><p class="a uf-id-b uf-id-z" id="uf-id-b"></p>', canonicalize),
    ).toBe('<i id="uf-id-1"></i>\n<p class="a uf-id-1 uf-id-2" id="uf-id-2"></p>\n');
  });

  describe("on every target's ids", () => {
    /**
     * A radio group (its `name` from one id) whose rows are `${base}-${index}`, beside a second
     * id that labels the group: each target's own ids, as it renders them (ADR-0049). Svelte
     * derives every id from one `$props.id()` with a suffix (`-0`, `-1`, …).
     */
    const group = (base: string, status: string, name: string) =>
      `<div role="radiogroup" aria-labelledby="${status}"><p id="${status}">Size</p>` +
      `<label><input type="radio" name="${name}" id="${base}-0" aria-describedby="${status}">S</label>` +
      `<label><input type="radio" name="${name}" id="${base}-1" aria-describedby="${status}">M</label>` +
      `<p>${base}-0 and ${base}-1</p></div>`;
    const formats: Record<string, [base: string, status: string, name: string]> = {
      vue: ["uf-id-v-0", "uf-id-v-1", "uf-id-v-2"],
      react: ["uf-id-_R_1_", "uf-id-_R_2_", "uf-id-_R_3_"],
      svelte: ["uf-id-s1-0", "uf-id-s1-1", "uf-id-s1-2"],
      solid: ["uf-id-cl-0", "uf-id-cl-1", "uf-id-cl-2"],
      angular: ["uf-id-sizes-0", "uf-id-sizes-1", "uf-id-sizes-2"],
      qwik: ["uf-id-B2t0", "uf-id-B2t1", "uf-id-B2t2"],
      astro: ["uf-id-1", "uf-id-2", "uf-id-3"],
    };

    it("normalises Vue's and each follower's ids to one text", () => {
      const reference = normalizeHtml(group(...formats.vue!));
      expect(reference).not.toContain("uf-id-v-");
      for (const [target, ids] of Object.entries(formats)) {
        expect(normalizeHtml(group(...ids)), target).toBe(reference);
      }
      // The status paragraph's id comes first: the group names it first.
      expect(reference).toContain('<p id="uf-id-1">');
      expect(reference).toContain('name="uf-id-3"');
    });

    it("still tells two ids that collide on a follower and not on the reference", () => {
      // Svelte's ids before every one carried a suffix: the status id `uf-id-s1-1` is also the
      // second row's `${base}-1` of the base `uf-id-s1`.
      const collided = normalizeHtml(group("uf-id-s1", "uf-id-s1-1", "uf-id-s1-2"));
      expect(collided).not.toBe(normalizeHtml(group(...formats.vue!)));
    });
  });

  it("does not erase a broken association", () => {
    const linked = '<label for="uf-id-a">A</label><input id="uf-id-a">';
    const broken = '<label for="uf-id-a">A</label><input id="uf-id-b">';
    expect(normalizeHtml(broken)).not.toBe(normalizeHtml(linked));
    expect(normalizeHtml(linked)).toBe(
      normalizeHtml('<label for="uf-id-z">A</label><input id="uf-id-z">'),
    );
  });
});
