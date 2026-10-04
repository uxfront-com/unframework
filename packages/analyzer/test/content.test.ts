import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component, root, slices } from "./helpers.ts";
import { randomSamples } from "./random.ts";

/** The text children of the component's root. */
function textsOf(jsx: string): string[] {
  const { module, diagnostics } = component(jsx);
  expect(diagnostics).toEqual([]);
  return root(module).children.map((child) =>
    child.kind === "Text" ? child.value : child.kind === "Element" ? `<${child.tag}>` : child.kind,
  );
}

describe("text JSX implementations read differently", () => {
  it("reports each place at its source, and lowers nothing of the text", () => {
    const source = "export function A() { return <p>a\tb&#10;c</p>; }";
    const { module, diagnostics } = component("<p>a\tb&#10;c</p>");
    expect(codes(diagnostics)).toEqual(["UF3009", "UF3009"]);
    expect(slices(source, diagnostics)).toEqual(["\t", "&#10;"]);
    expect(module!.components).toEqual([]);
  });

  it("fixes what has a fix to what Babel reads, and keeps the rest reported", () => {
    const { source, diagnostics } = component(
      "(\n  <p>\n    Price:\u00a0\n    10\u2028km\tor <b>more</b>&#32;\n    here&#10;and&#+65;\n  </p>\n)",
    );
    expect(slices(source, diagnostics)).toEqual([
      "\u00a0",
      "\u2028",
      "\t",
      "&#32;",
      "&#10;",
      "&#+65;",
    ]);
    expect(diagnostics.map((diagnostic) => diagnostic.fixes?.[0]?.title)).toEqual([
      "Write `&nbsp;`",
      "Write `&#x2028;`",
      "Write a space",
      "Remove it",
      "Write a line break",
      undefined,
    ]);
    const fixed = applyAndRecheck(source, diagnostics);
    expect(fixed).toContain("Price:&nbsp;\n    10&#x2028;km or <b>more</b>\n    here\nand&#+65;");
  });

  it("lowers text every implementation reads alike", () => {
    expect(textsOf("(\n  <p>\n    Tom &amp; Jerry&nbsp;\n    <b>x</b> y\n  </p>\n)")).toEqual([
      "Tom & Jerry\u00a0",
      "<b>",
      " y",
    ]);
  });

  it("keeps a whitespace reference reported when its fix would reveal another divergence", () => {
    const { source, diagnostics } = component("<p>a&#10;\u00a0b</p>");
    expect(codes(diagnostics)).toEqual(["UF3009"]);
    expect(diagnostics[0]!.fixes).toBeUndefined();
    applyAndRecheck(source, diagnostics);
  });

  it("reports a void element whose content only some implementations read", () => {
    const { diagnostics } = component("<div><br>&#10;</br></div>");
    expect(codes(diagnostics)).toEqual(["UF3003"]);
  });
});

describe("characters HTML would not keep, in text", () => {
  it.each([
    ["<p>a&#0;b</p>", "&#0;"],
    ["<p>a&#7;b</p>", "&#7;"],
    ["<p>a&#x9F;b</p>", "&#x9F;"],
    ["<p>a&#xFFFF;b</p>", "&#xFFFF;"],
    ["<p>a\u0001b</p>", "\u0001"],
  ])("reports %j", (jsx, at) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3010"]);
    expect(slices(source, diagnostics)).toEqual([at]);
  });

  // TypeScript, oxc and esbuild trim a vertical tab or U+0085 at a line break, and Babel keeps
  // it: either way HTML does not keep it, so it is UF3010 alone.
  it.each([
    ["(\n  <p>\n    a\u000b\n  </p>\n)", "\u000b"],
    ["<p>a \u0085\nb</p>", "\u0085"],
  ])("reports the control character in %j as UF3010 wherever it is", (jsx, at) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3010"]);
    expect(slices(source, diagnostics)).toEqual([at]);
  });

  // Fixing a space beside it, which the implementations read differently, leaves its UF3010.
  it.each(["<p>a\u000b\u00a0\nb</p>", "<p>a\u2028\u000b</p>", "<p>a&#10;\u0085\u3000b</p>"])(
    "fixes the rest of %j, and keeps the control character reported",
    (jsx) => {
      const { source, diagnostics } = component(jsx);
      expect(codes(diagnostics).toSorted()).toEqual(["UF3009", "UF3010"]);
      applyAndRecheck(source, diagnostics);
    },
  );

  it("accepts characters HTML keeps", () => {
    expect(textsOf("<p>a&#12;b\u00a0c&#xFFFD;😀&#x1F600;</p>")).toEqual(["a\fb\u00a0c\ufffd😀😀"]);
  });
});

describe("the fixes of random text", () => {
  /** Characters and references the JSX readings, HTML and the targets each treat apart. */
  const PIECES = [
    "a",
    "word",
    " ",
    "  ",
    "\t",
    "\n",
    "\r\n",
    "\u000b",
    "\u000c",
    "\u0085",
    "\u00a0",
    "\u1680",
    "\u2003",
    "\u200b",
    "\u2028",
    "\u2029",
    "\u3000",
    "\ufeff",
    "&#32;",
    "&#9;",
    "&#10;",
    "&#13;",
    "&nbsp;",
    "&#x2028;",
    "&amp;",
    "&",
    "&#+65;",
    "&#xD83D;",
    "&#xDE00;",
    "&#0;",
    "&check;",
    "&NewLine;",
    "&ThinSpace;",
  ];
  const WRAPPERS = [
    (text: string) => `<p>${text}</p>`,
    (text: string) => `<div>${text}<b>x</b>${text}</div>`,
    (text: string) => `<select>${text}<option>o</option></select>`,
    (text: string) => `<table><tbody><tr>${text}<td>c</td></tr></tbody></table>`,
  ];

  // Plan §5.9 and the harness's L1: applying every fix leaves exactly the diagnostics that had
  // none. A vertical tab or U+0085 beside a fixed space once turned its UF3009 into a UF3010.
  it("leave exactly the diagnostics that have none", () => {
    let checked = 0;
    for (const [index, text] of randomSamples(3, 10_000, PIECES).entries()) {
      const { source, diagnostics } = component(WRAPPERS[index % WRAPPERS.length]!(text));
      if (!diagnostics.some((diagnostic) => diagnostic.fixes?.length)) continue;
      applyAndRecheck(source, diagnostics);
      checked++;
    }
    expect(checked).toBeGreaterThan(5000);
  });
});

describe("whitespace Svelte drops", () => {
  it.each([
    ["<div><select><option>a</option> <option>b</option></select></div>", "select"],
    [
      '<div><datalist id="d"><option value="a" /> <option value="b" /></datalist></div>',
      "datalist",
    ],
  ])("reports the whitespace between the options in %s, and the fix removes it", (jsx, parent) => {
    const { source, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3003"]);
    expect(slices(source, diagnostics)).toEqual([" "]);
    expect(diagnostics[0]).toMatchObject({
      message: `Text that is only whitespace cannot be inside <${parent}>: Svelte's compiler drops it, and the other targets keep it.`,
      fixes: [{ title: "Remove the whitespace", confidence: "safe" }],
    });
    expect(applyAndRecheck(source, diagnostics)).not.toContain("> <option");
  });

  it("accepts options on lines of their own, where JSX drops the whitespace", () => {
    const jsx = [
      "(",
      "  <div>",
      "    <select>",
      "      <option>a</option>",
      "      <option>b</option>",
      "    </select>",
      "  </div>",
      ")",
    ].join("\n");
    expect(component(jsx).diagnostics).toEqual([]);
  });

  it("accepts text that is not only whitespace in a datalist", () => {
    expect(component('<div><datalist id="d">Pick one</datalist></div>').diagnostics).toEqual([]);
  });
});

describe("references only HTML decodes", () => {
  it.each(["toString", "valueOf", "__proto__", "constructor", "hasOwnProperty"])(
    "reads &%s;, which names no entity, as text",
    (name) => {
      expect(textsOf(`<p>x &${name}; y</p>`)).toEqual([`x &${name}; y`]);
    },
  );

  // JSX knows XHTML's names only: every target renders `&check;` as written (UF3011).
  it.each([
    ["<p>a &check; b</p>", "&check;", "&#x2713;", "a \u2713 b"],
    ["<p>a &rbrace; b</p>", "&rbrace;", "&#x7D;", "a } b"],
    ["<p>&NotEqualTilde;</p>", "&NotEqualTilde;", "&#x2242;&#x338;", "\u2242\u0338"],
    [
      "<p>&CounterClockwiseContourIntegral;</p>",
      "&CounterClockwiseContourIntegral;",
      "&#x2233;",
      "\u2233",
    ],
  ])("warns about %s, lowers it as JSX reads it, and fixes it", (jsx, at, numeric, fixedText) => {
    const { source, module, diagnostics } = component(jsx);
    expect(codes(diagnostics)).toEqual(["UF3011"]);
    expect(diagnostics[0]).toMatchObject({
      severity: "warning",
      message: `\`${at}\` is an HTML character reference, which JSX does not decode: every target renders it as the text \`${at}\`.`,
      fixes: [{ title: `Write \`${numeric}\``, confidence: "likely" }],
    });
    expect(slices(source, diagnostics)).toEqual([at]);
    expect(root(module).children).toEqual([expect.objectContaining({ value: jsx.slice(3, -4) })]);
    const fixed = applyAndRecheck(source, diagnostics);
    expect(textsOf(fixed.slice(fixed.indexOf("<"), fixed.lastIndexOf(">") + 1))).toEqual([
      fixedText,
    ]);
  });

  it("warns about a reference in an attribute, and fixes it", () => {
    const { source, diagnostics } = component('<p title="&check; done" class="a&hyphen;b">x</p>');
    expect(codes(diagnostics)).toEqual(["UF3011", "UF3011"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(
      'title="&#x2713; done" class="a&#x2010;b"',
    );
  });

  // Where the numeric reference would itself be a problem, or change another's message.
  it.each([
    "<p>a&Tab;b</p>",
    "<p>a&NewLine;b</p>",
    "<p>a\tb &check;</p>",
    '<p class="a&ThinSpace;b">x</p>',
    '<a href="&num;uf-id-x">x</a>',
    '<input disabled="&check;" />',
    '<p title="x" title="&check;">a</p>',
  ])("warns about the reference in %s without a fix", (jsx) => {
    const { source, diagnostics } = component(jsx);
    const warning = diagnostics.find((diagnostic) => diagnostic.code === "UF3011")!;
    expect(warning.fixes).toBeUndefined();
    applyAndRecheck(source, diagnostics);
  });

  it("does not warn about a reference written as text", () => {
    expect(textsOf("<p>&amp;check; &copy;</p>")).toEqual(["&check; \u00a9"]);
  });
});
