// The analyser's reading of JSX text and attribute strings against the implementations it stands
// for: Babel (Vue's and Solid's JSX), and Vite's oxc and esbuild transforms (oxc is the React
// target's JSX; TypeScript's transform reads text as oxc does, and the reference cases where
// they differ are reported anyway). TypeScript itself is not run: only the test toolchains load
// its API (AGENTS.md). Wherever the three agree, the analyser must accept the text with their
// value; wherever they disagree, it must report UF3009; and its fixes must make them agree on
// what Babel read. A character HTML does not keep is UF3010 instead, wherever it is, so text
// that holds one is compared as if it held another character there.
import { parseSync, types } from "@babel/core";
import type { Node } from "@babel/core";
import { unkeptCharacter } from "@unframework/ir";
import { defaultTreeAdapter, html as spec, parseFragment } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";
import { transformWithEsbuild, transformWithOxc } from "vite";
import { describe, expect, it } from "vitest";

import { unportableCharacters } from "../src/characters.ts";
import { htmlOnlyReferences, readJsxAttribute, readJsxText } from "../src/index.ts";
import type { JsxReading } from "../src/index.ts";
import { XHTML_ENTITIES } from "../src/jsx/entities.ts";
import { HTML_ONLY_ENTITIES } from "../src/jsx/html-entities.ts";
import { randomSamples } from "./random.ts";

/** What one implementation reads, or `null` when it fails on the source. */
type Reading = string | null;

const FAILS = null;

/** JSX for each sample, in one array, so each implementation runs once per batch. */
function module(samples: readonly string[], kind: "text" | "attribute"): string {
  const elements = samples.map((raw) =>
    kind === "text" ? `<p>${raw}</p>` : `<p title="${raw}" />`,
  );
  return `x = [\n${elements.join(",\n")}\n];`;
}

function babel(samples: readonly string[], kind: "text" | "attribute"): Reading[] {
  try {
    const file = parseSync(module(samples, kind), {
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ["jsx"] },
    })!;
    const statement = file.program.body[0] as types.ExpressionStatement;
    const array = (statement.expression as types.AssignmentExpression)
      .right as types.ArrayExpression;
    return array.elements.map((element) => {
      const jsx = element as types.JSXElement;
      if (kind === "attribute") {
        const attribute = jsx.openingElement.attributes[0] as types.JSXAttribute;
        return (attribute.value as types.StringLiteral).value;
      }
      // Babel's React preset reads JSX children this way (cleanJSXElementLiteralChild).
      return types.react
        .buildChildren(jsx)
        .map((child: Node) => (child as types.StringLiteral).value)
        .join("");
    });
  } catch (error) {
    // Babel fails on a reference past U+10FFFF: find the samples it fails on one by one.
    if (!(error instanceof RangeError)) throw error;
    return samples.length === 1 ? [FAILS] : samples.flatMap((sample) => babel([sample], kind));
  }
}

/** Runs compiled `x = [h("p", props, ...children), …]` and reads each element's text. */
function evaluate(code: string, kind: "text" | "attribute"): Reading[] {
  const h = (_tag: string, props: { title?: string } | null, ...children: string[]) =>
    kind === "text" ? children.join("") : props!.title!;
  // oxlint-disable-next-line typescript/no-implied-eval -- runs the transform's output, which is what is compared
  return new Function("h", `let x; ${code}; return x;`)(h) as Reading[];
}

async function oxc(samples: readonly string[], kind: "text" | "attribute"): Promise<Reading[]> {
  const { code } = await transformWithOxc(module(samples, kind), "samples.jsx", {
    lang: "jsx",
    jsx: { runtime: "classic", pragma: "h" },
  });
  return evaluate(code, kind);
}

async function esbuild(samples: readonly string[], kind: "text" | "attribute"): Promise<Reading[]> {
  const { code } = await transformWithEsbuild(module(samples, kind), "samples.jsx", {
    loader: "jsx",
    jsxFactory: "h",
  });
  return evaluate(code, kind);
}

/** Every implementation's reading of each sample. */
async function readings(
  samples: readonly string[],
  kind: "text" | "attribute",
): Promise<{ babel: Reading; oxc: Reading; esbuild: Reading }[]> {
  const [fromBabel, fromOxc, fromEsbuild] = [
    babel(samples, kind),
    await oxc(samples, kind),
    await esbuild(samples, kind),
  ];
  return samples.map((_, index) => ({
    babel: fromBabel[index]!,
    oxc: fromOxc[index]!,
    esbuild: fromEsbuild[index]!,
  }));
}

/** The raw text with every divergence's replacement applied, or `undefined` if one has none. */
function fixed(raw: string, reading: JsxReading): string | undefined {
  if (reading.divergences.some((divergence) => divergence.replacement === undefined)) {
    return undefined;
  }
  let out = raw;
  for (const divergence of reading.divergences.toReversed()) {
    out = out.slice(0, divergence.start) + divergence.replacement! + out.slice(divergence.end);
  }
  return out;
}

/** The pieces where the implementations can part: whitespace of every kind, and references. */
const PIECES = [
  "a",
  "b",
  "word",
  " ",
  "  ",
  "\t",
  "\n",
  "\r\n",
  "\r",
  "\u000b",
  "\u000c",
  "\u0085",
  "\u00a0",
  "\u1680",
  "\u2003",
  "\u200b",
  "\u2028",
  "\u2029",
  "\u202f",
  "\u3000",
  "\ufeff",
  "&#32;",
  "&#x20;",
  "&#9;",
  "&#10;",
  "&#13;",
  "&#xA;",
  "&nbsp;",
  "&#160;",
  "&#x2028;",
  "&amp;",
  "&lt;",
  "&",
  "&#+65;",
  "&#x-1;",
  "&#xD83D;",
  "&#xDE00;",
  "&#1114112;",
  "&#0;",
];

/** How many samples the implementations agreed on, how many they did not, and how many fixes ran. */
interface Tally {
  agreed: number;
  reported: number;
  fixed: number;
}

/**
 * The raw text with each raw character HTML does not keep written as `!`, which no
 * implementation trims and no reference holds. A line break's carriage return stays.
 */
function asCharacters(raw: string): string {
  let out = "";
  for (const char of raw) {
    out += char !== "\r" && unkeptCharacter(char.codePointAt(0)!) ? "!".repeat(char.length) : char;
  }
  return out;
}

/**
 * A character HTML does not keep is UF3010 wherever it is, so the analyser reads it as Babel
 * does, as a character, though TypeScript, oxc and esbuild trim a vertical tab or U+0085 at a
 * line break. Checks that it reads the text as it reads `comparable` (the same text with `!`
 * there, which the implementations are compared on instead), and reports every such character.
 */
function asCharacterMismatches(raw: string, comparable: string): string[] {
  const reading = readJsxText(raw);
  const shape = ({ divergences, kept }: JsxReading) =>
    JSON.stringify({ divergences, kept: kept.map(({ start, end }) => [start, end]) });
  const mismatches: string[] = [];
  if (shape(reading) !== shape(readJsxText(comparable))) {
    mismatches.push(`${JSON.stringify(raw)}: read unlike ${JSON.stringify(comparable)}`);
  }
  const reported = new Set(
    unportableCharacters(raw, reading.kept, reading.divergences).map(({ start }) => start),
  );
  let offset = 0;
  for (const char of raw) {
    if (char !== "\r" && unkeptCharacter(char.codePointAt(0)!) && !reported.has(offset)) {
      mismatches.push(`${JSON.stringify(raw)}: the character at ${offset} is not reported`);
    }
    offset += char.length;
  }
  return mismatches;
}

/**
 * Checks the analyser against the implementations on each sample; returns the mismatches, and
 * counts what was checked into `tally`.
 */
async function conformance(
  samples: readonly string[],
  kind: "text" | "attribute",
  tally: Tally = { agreed: 0, reported: 0, fixed: 0 },
): Promise<string[]> {
  const mismatches: string[] = [];
  const raws =
    kind === "attribute"
      ? samples
      : samples.map((sample) => {
          const comparable = asCharacters(sample);
          if (comparable !== sample) mismatches.push(...asCharacterMismatches(sample, comparable));
          return comparable;
        });
  const read = kind === "text" ? readJsxText : readJsxAttribute;
  const all = await readings(raws, kind);
  const fixes = raws.map((raw) => fixed(raw, read(raw)));
  const fixable = fixes.filter((fix): fix is string => fix !== undefined && fix !== "");
  const afterFix = new Map<string, Awaited<ReturnType<typeof readings>>[number]>();
  const fixedReadings = await readings(fixable, kind);
  fixable.forEach((raw, index) => afterFix.set(raw, fixedReadings[index]!));

  raws.forEach((raw, index) => {
    const { babel: b, oxc: o, esbuild: e } = all[index]!;
    const agree = b !== FAILS && b === o && b === e;
    const reading = read(raw);
    const label = `${JSON.stringify(raw)} (babel ${JSON.stringify(b)}, oxc ${JSON.stringify(o)}, esbuild ${JSON.stringify(e)})`;
    if (agree !== (reading.divergences.length === 0)) {
      mismatches.push(`${label}: ${agree ? "reported" : "accepted"} ${JSON.stringify(reading)}`);
      return;
    }
    if (agree && reading.value !== b) {
      mismatches.push(`${label}: read ${JSON.stringify(reading.value)}`);
      return;
    }
    if (agree) tally.agreed++;
    else tally.reported++;
    const fix = fixes[index];
    if (agree || fix === undefined) return;
    tally.fixed++;
    if (read(fix).divergences.length) {
      mismatches.push(`${label}: fixed to ${JSON.stringify(fix)}, still reported`);
      return;
    }
    const after = afterFix.get(fix) ?? { babel: "", oxc: "", esbuild: "" };
    if (after.babel !== b || after.oxc !== b || after.esbuild !== b) {
      mismatches.push(`${label}: fixed to ${JSON.stringify(fix)}, read ${JSON.stringify(after)}`);
    }
  });
  return mismatches;
}

describe("JSX text", () => {
  // Each one is a difference the implementations really have.
  it.each([
    ["a\tb", "a tab inside a line"],
    ["x\u00a0\n  y", "a no-break space before a line break"],
    ["x\n\u00a0\ny", "a line of no-break space"],
    ["a\u2028b", "a line separator"],
    ["a\u200b\nb", "a zero-width space before a line break, which esbuild keeps"],
    ["&#10;a", "a referenced line feed"],
    ["a&#9;b", "a referenced tab"],
    ["Hello&#32;\n  ", "a referenced space before a line break"],
    ["&#+65;", "a signed reference"],
    ["&#xD83D;&#xDE00;", "a surrogate pair"],
    ["&#1114112;", "a reference past U+10FFFF"],
  ])("reports %j, %s", async (raw) => {
    const [reading] = await readings([raw], "text");
    expect(new Set(Object.values(reading!)).size).toBeGreaterThan(1);
    expect(readJsxText(raw).divergences).not.toEqual([]);
    expect(await conformance([raw], "text")).toEqual([]);
  });

  it.each([
    "  spaces on one line  ",
    "\n    Line one\n    Line two\n  ",
    "a\n\n\nb",
    "Tom &amp; Jerry &nbsp;\n  next",
    "&#160;\na",
    "a&#x2028;\nb",
    " a b ",
    "\u00a0",
    "a\u00a0b",
    "a&#32;b",
  ])("accepts %j, which every implementation reads alike", async (raw) => {
    const [reading] = await readings([raw], "text");
    expect(new Set(Object.values(reading!)).size).toBe(1);
    expect(readJsxText(raw)).toMatchObject({ divergences: [], value: reading!.babel });
  });

  // The implementations differ on each only where TypeScript, oxc or esbuild trim the vertical
  // tab or U+0085 at a line break, with the whitespace beside it: HTML keeps neither character,
  // so the text is UF3010 alone.
  it.each(["a \u000b\nb", "\u000b\nb", "a\u0085\n", "a\u00a0\u000b\nb", "a&#32;\u000b\nb"])(
    "reports the character HTML does not keep in %j as that, and nothing else",
    async (raw) => {
      const [reading] = await readings([raw], "text");
      expect(new Set(Object.values(reading!)).size).toBeGreaterThan(1);
      expect(readJsxText(raw).divergences).toEqual([]);
      expect(await conformance([raw], "text")).toEqual([]);
    },
  );

  // Where the rest of the text diverges as well, the fixes make it read alike; the character's
  // UF3010 is left.
  it.each([
    ["a\u000b\u00a0\nb", "a\u000b&nbsp;\nb"],
    ["a\u2028\u000b", "a&#x2028;\u000b"],
    ["a&#10;\u000b\u00a0b", "a\n\u000b\u00a0b"],
  ])("fixes the rest of %j to %j", async (raw, fix) => {
    expect(fixed(raw, readJsxText(raw))).toBe(fix);
    expect(readJsxText(fix).divergences).toEqual([]);
    expect(await conformance([raw], "text")).toEqual([]);
  });

  it("agrees with Babel, oxc and esbuild on random text", async () => {
    const tally = { agreed: 0, reported: 0, fixed: 0 };
    expect(await conformance(randomSamples(1, 3000, PIECES), "text", tally)).toEqual([]);
    // Both outcomes, and the fixes, must be well exercised, or the sweep proves little. With
    // the rewrites of `&#9;`, `&#10;`, `&#13;` and a trimmed `&#32;`, about a third of the
    // reported samples have a fix for every divergence (764 of 2,138 with this seed).
    expect(tally.agreed).toBeGreaterThan(500);
    expect(tally.reported).toBeGreaterThan(500);
    expect(tally.fixed).toBeGreaterThan(700);
  }, 60_000);
});

describe("JSX attribute strings", () => {
  it.each([
    ["&#+65;", undefined],
    ["&#x-1;", undefined],
    ["&#1114112;", undefined],
    ["a&#xD83D;b", undefined],
    ["&#xD83D;&#xDE00;", "&#x1F600;"],
    ["&#55357;&#56832;!", "&#x1F600;!"],
  ])("reports %j, and fixes it to %j", async (raw, fix) => {
    const reading = readJsxAttribute(raw);
    expect(reading.divergences).toHaveLength(1);
    expect(fixed(raw, reading)).toBe(fix);
    expect(await conformance([raw], "attribute")).toEqual([]);
  });

  it.each([
    "a\nb",
    "a\r\nb",
    "a\tb",
    "  a  ",
    "a&#10;b",
    "a\u2028b",
    "&amp;&nbsp;&#x41;",
    "&lbrace;",
  ])("reads %j as every implementation does", async (raw) => {
    const [reading] = await readings([raw], "attribute");
    expect(new Set(Object.values(reading!)).size).toBe(1);
    expect(readJsxAttribute(raw)).toMatchObject({ divergences: [], value: reading!.babel });
  });

  // Attribute strings keep their whitespace in every implementation: only references differ.
  it("agrees with Babel, oxc and esbuild on random strings", async () => {
    const tally = { agreed: 0, reported: 0, fixed: 0 };
    expect(await conformance(randomSamples(2, 1000, PIECES), "attribute", tally)).toEqual([]);
    expect(tally.agreed).toBeGreaterThan(300);
    expect(tally.reported).toBeGreaterThan(100);
    // Only a surrogate pair has a fix in an attribute string; the cases below cover more.
    expect(tally.fixed).toBeGreaterThan(0);
  }, 60_000);
});

// HTML decodes some 2,125 named references; JSX only XHTML's 253. The rest render as written on
// every target, which UF3011 warns about.
describe("HTML's named references", () => {
  const names = [...HTML_ONLY_ENTITIES.keys()];

  it("are WHATWG's list less XHTML's names, each once", () => {
    expect(names.filter((name) => XHTML_ENTITIES.has(name))).toEqual([]);
    expect(HTML_ONLY_ENTITIES.size + XHTML_ENTITIES.size).toBe(2125);
  });

  it("decode in the HTML parser as listed, to characters HTML keeps", () => {
    const body = defaultTreeAdapter.createElement("body", spec.NS.HTML, []);
    const fragment = parseFragment(body, names.map((name) => `<p>&${name};</p>`).join(""), {});
    const decoded = fragment.childNodes.map(
      (p) =>
        ((p as DefaultTreeAdapterTypes.Element).childNodes[0] as DefaultTreeAdapterTypes.TextNode)
          .value,
    );
    expect(decoded).toEqual([...HTML_ONLY_ENTITIES.values()]);
    const unkept = names.filter((name) =>
      htmlOnlyReferences(`&${name};`)[0]!.codePoints.some((code) => unkeptCharacter(code)),
    );
    expect(unkept).toEqual([]);
  });

  it("stay as written in Babel's, oxc's and esbuild's JSX, and their fixes decode", async () => {
    const samples = names.map((name) => `&${name};`);
    for (const [index, reading] of (await readings(samples, "attribute")).entries()) {
      expect(reading).toEqual({
        babel: samples[index],
        oxc: samples[index],
        esbuild: samples[index],
      });
    }
    const numeric = samples.map((sample) => htmlOnlyReferences(sample)[0]!.numeric);
    const values = [...HTML_ONLY_ENTITIES.values()];
    for (const [index, reading] of (await readings(numeric, "attribute")).entries()) {
      expect(reading).toEqual({ babel: values[index], oxc: values[index], esbuild: values[index] });
    }
  }, 60_000);
});
