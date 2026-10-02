import { ID_REFERENCE_ATTRIBUTES } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { normalizeHtml } from "../src/normalize/index.ts";
import { printTree } from "../src/normalize/print.ts";
import { isAngularHost, unwrapAngularHosts } from "../src/normalize/rules/angular-hosts.ts";
import { removeComments } from "../src/normalize/rules/comments.ts";
import {
  isFrameworkAttribute,
  removeFrameworkAttributes,
} from "../src/normalize/rules/framework-attributes.ts";
import { canonicalizeGeneratedIds } from "../src/normalize/rules/generated-ids.ts";
import { canonicalizeClasses, sortAttributes } from "../src/normalize/rules/ordering.ts";
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
    ["Qwik 1 listeners", "qwik", '<p on:click="x" on-document:load="y" on-window:resize="z">a</p>'],
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

  it("does not erase a different, a duplicated or an empty class", () => {
    expect(normalizeHtml('<p class="a b"></p>')).not.toBe(normalizeHtml('<p class="a c"></p>'));
    expect(normalizeHtml('<p class="a a"></p>')).not.toBe(normalizeHtml('<p class="a"></p>'));
    expect(normalizeHtml('<p class=""></p>')).not.toBe(normalizeHtml("<p></p>"));
  });

  it("leaves other attributes' tokens in order", () => {
    expect(apply('<p aria-describedby="b a"></p>', canonicalizeClasses)).toBe(
      '<p aria-describedby="b a"></p>\n',
    );
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
    ["an empty declaration list", " ; ", ""],
  ])("canonicalises %s", (_, style, expected) => {
    expect(apply(`<p style='${style}'></p>`, canonicalizeStyles)).toBe(
      `<p style=${JSON.stringify(expected)}></p>\n`,
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
    // React's useId is `«r1»` in 19.1 and `:r1:` before it; M2 prefixes it like any other.
    expect(apply('<p id="uf-id-«r1»"></p><p aria-labelledby="uf-id-:r1:"></p>', canonicalize)).toBe(
      '<p id="uf-id-1"></p>\n<p aria-labelledby="uf-id-2"></p>\n',
    );
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

  it("leaves values that are not references alone", () => {
    const html =
      '<a href="/page#uf-id-0" data-id="uf-id-0" title="see #uf-id-0">uf-id-0</a><p style="background: url(/a.png#uf-id-0)"></p>';
    expect(apply(html, canonicalize)).toBe(apply(html));
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
