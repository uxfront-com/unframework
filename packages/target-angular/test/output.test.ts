// The emitter's output for M1's constructs (plan §6), judged by Angular itself: sources
// lowered by the analyser and emitted as the compiler writes them pass ngtsc with strict
// templates and its extended diagnostics (L3), the toolchain's type check (L4) and its linters
// (L5) with no message, for these sources and for every case of the corpus (whose committed
// goldens the compile project compares with this run's output, L2), and Angular's server platform
// renders the DOM the source describes for the props given, left out or explicitly `undefined`.
// The render-parity kit compares every
// construct with the reference; these pin the shapes only Angular needs: the `@let` reads, a
// prop in a `track`, the defaults' transforms, the globals as members and template literals as
// concatenations.
// Angular's own packages ship partially compiled; in this plain-Node project the JIT compiler
// finishes them as they load (see render-parity.test.ts). The components are compiled ahead of
// time by ngtsc either way.
// oxlint-disable-next-line import/no-unassigned-import -- loaded for its side effect
import "@angular/compiler";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { format as formatMessage } from "node:util";

import type { OutputFile } from "@unframework/codegen";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { canonical } from "../../codegen/test/markup-cases.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { renderToString } from "../src/toolchain/server.ts";
import {
  context,
  corpusSources,
  emitFormatted,
  formatted,
  lower,
  ngtscPlugin,
  removeScratch,
  scratchDir,
} from "./helpers.ts";
import { M2_SOURCES } from "./lint-probes.ts";

afterAll(removeScratch);

/** Sources by component name, each showing what Angular needs of the emitter. */
const SOURCES: Readonly<Record<string, string>> = {
  // Defaults: absent and `undefined` take them, `null` stays a value (ADR-0034).
  Notice: `
type Tone = "info" | "warn" | undefined;

export interface NoticeProps {
  tone?: Tone;
  size?: number;
  label?: string | null;
  tags?: readonly string[];
}

export default function Notice({ tone = "info", size = 1000, label = null, tags = [] }: NoticeProps) {
  return (
    <p data-tone={tone} data-size={size}>
      {tone.toUpperCase()}|{label ?? "none"}|{tags.join(",")}
    </p>
  );
}
`,
  // Narrowing: TypeScript narrows each of these, and so does Angular through a variable.
  Owner: `
interface Person {
  name: string;
  email?: string;
}

export interface OwnerProps {
  owner?: Person;
  phone?: string | null;
  count?: number;
  tags: string[];
  value: string | number;
}

export default function Owner({ owner, phone, count, tags, value }: OwnerProps) {
  return (
    <div>
      {owner && <p>{owner.name.toUpperCase()}</p>}
      {owner?.email && <a href={\`mailto:\${owner.email}\`}>{owner.email.length}</a>}
      {phone ? <p>{phone.trim()}</p> : <p>no phone</p>}
      {count !== undefined && count > 0 && <p>{count.toFixed(1)}</p>}
      <p>{tags[0] && tags[0].toUpperCase()}</p>
      <p>{typeof value === "string" ? value.toUpperCase() : value.toFixed(2)}</p>
    </div>
  );
}
`,
  // A prop in a key is read from its input there; the index only the key reads is declared.
  Rows: `
export interface RowsProps {
  prefix: string;
  rows: { id: string; label: string }[];
}

export default function Rows({ prefix, rows }: RowsProps) {
  return (
    <ul>
      {rows.map((row) => <li key={prefix + row.id}>{prefix}{row.label}</li>)}
      {rows.map((row, index) => <li key={index}>{row.label.toUpperCase()}</li>)}
    </ul>
  );
}
`,
  // Globals are members; template literals are concatenations that never add numbers.
  Totals: `
export interface TotalsProps {
  values: number[];
  first: number;
  second: number;
}

export default function Totals({ values, first, second }: TotalsProps) {
  return (
    <p title={JSON.stringify(values)} style={{ width: \`\${first}px\` }}>
      {Math.max(...values)}|{\`\${first}\${second}\`}|{\`\${first + second}!\`}|{String(undefined)}
    </p>
  );
}
`,
  // ES2023's copying array methods, the analyser's fixes for the mutating ones (UF3021): L3 and
  // L4 check them with ES2024's library, as every other target's checker does.
  Ranking: `
export interface RankingProps {
  scores: number[];
}

export default function Ranking({ scores }: RankingProps) {
  return (
    <ol title={scores.toReversed().join(" ")}>
      {scores.toSorted((a, b) => b - a).toSpliced(2).map((score) => <li key={score}>{score}</li>)}
    </ol>
  );
}
`,
  // Blank text right after a block, which Angular's parser would drop while it looks for the
  // block's `@else` or `@empty`: a space, a non-breaking space, a space in \`<pre>\`.
  Spacing: `
export interface SpacingProps {
  on: boolean;
  names: string[];
}

export default function Spacing({ on, names }: SpacingProps) {
  return (
    <div>
      <p>{on && <i>a</i>}{" "}<b>b</b></p>
      <p>{on ? <i>c</i> : <u>d</u>}{"\u00a0"}<b>e</b></p>
      <p>{names.map((name) => <i key={name}>{name}</i>)}{" "}<b>f</b></p>
      <pre>{on && <i>g</i>}{" "}<b>h</b></pre>
    </div>
  );
}
`,
  // What Angular's template reads in literals and between tokens: a regular expression's
  // quotes, `;`, parentheses, `//` and named groups, U+E500, whitespace outside ASCII, the
  // blocks in an SVG title, a bare `&` before a reference in an interpolation, and a quote
  // before a `//` in text it writes as a literal.
  Patterns: `
export interface PatternsProps {
  label: string;
  on: boolean;
}

export default function Patterns({ label, on }: PatternsProps) {
  return (
    <div title={/'/.test(label) ? "quoted" : "plain"}>
      {/^\\//.test(label) && <b>slash</b>}
      {label.split(/[;)]/).map((part) => <i key={part}>{part}</i>)}
      <p>x\ue500y{label\u3000+ label}|{on && /(?<x>a)\\k<x>/.test(label) ? "named" : "none"}</p>
      <svg viewBox="0 0 2 2"><title>{label}{on && " on"}</title></svg>
      <p>{(label&&"set") || "none"}|{label && /R&D/.test(label) ? "rd" : "other"}</p>
      <p>{'Visit "https://a.b".  Thanks'}</p>
    </div>
  );
}
`,
  // Quotes in strings: angular-eslint lints the raw text of the template literal the template
  // sits in, where a backslash before a quote is doubled and ends the string (L5), so every
  // string takes the quote its value does not hold, and an escaped regular expression character
  // is written as a code.
  Quotes: `
export interface QuotesProps {
  name: string;
  saved: boolean;
}

export default function Quotes({ name, saved }: QuotesProps) {
  return (
    <div title={saved ? "Saved" : "Don't forget to save"} aria-label={\`\${name}'s results\`}>
      <p>{saved ? "Saved" : 'Not "saved" yet'}|{\`Results for "\${name}"\`}|{name + "it's \\"x\\""}</p>
      <p>Visit "https://a.b".  Thanks</p>
      {name === 'say "hi"' && <b>hi</b>}
      <ul>{[name].map((x) => <li key={x + "'"}>{x}</li>)}</ul>
      <p title={/a\\/b|[\\]]|\\(/.test(name) ? "match" : "none"}>{/^\\(/.test(name) && "paren"}</p>
    </div>
  );
}
`,
  // The object form, and a component named after Angular's decorator.
  Component: `
export function Component(props: { author: string; minutes?: number }) {
  return <p>By {props.author}, {props.minutes ?? 1} min</p>;
}
`,
  // Spreads (ADR-0039): a source that may be nullish reads its keys through `?.`, and one a
  // condition narrows through `.`, as NG8107 requires of a narrowed member.
  Spreads: `
interface Attrs {
  id: string;
  title?: string;
  class?: string;
}

interface Box {
  inner?: Attrs;
}

export interface SpreadsProps {
  empty: Attrs | null;
  box: Box;
  opt?: Attrs;
  rows: (Attrs | undefined)[];
}

export default function Spreads({ empty, box, opt, rows }: SpreadsProps) {
  return (
    <div>
      <p {...empty}>a</p>
      <p class="b" {...box.inner}>b</p>
      {box.inner && <i {...box.inner}>c</i>}
      {!opt ? null : <b {...opt}>d</b>}
      <ul>{rows.map((row, index) => <li key={index} {...row}>e</li>)}</ul>
    </div>
  );
}
`,
};

/** Each source's output, formatted as the compiler writes it, by component name. */
const outputs = new Map<string, OutputFile>();

beforeAll(async () => {
  for (const [name, source] of Object.entries(SOURCES)) {
    outputs.set(name, await formatted(source));
  }
});

/**
 * What L3, L4 and L5 report about each file, by its path: the files are written to a scratch
 * directory of their own, under `prefix` when two share a name.
 */
async function toolchainMessages(
  files: readonly (OutputFile & { prefix?: string })[],
): Promise<Record<string, string[]>> {
  const directory = scratchDir();
  const written = files.map((file) => ({
    path: join(directory, `${file.prefix ?? ""}${file.path}`),
    contents: file.contents,
  }));
  for (const file of written) writeFileSync(file.path, file.contents);
  const paths = written.map((file) => file.path);
  const [compiledFiles, checked, linted] = await Promise.all([
    toolchain.frameworkCompile(written, context),
    toolchain.typecheck(paths, context),
    toolchain.lint(paths, context),
  ]);
  return Object.fromEntries(
    paths.map((path) => [
      path.slice(directory.length + 1),
      [
        ...(compiledFiles.get(path)?.errors ?? []),
        ...(compiledFiles.get(path)?.warnings ?? []),
        ...(checked.get(path) ?? []),
        ...(linted.get(path) ?? []),
      ].map(({ code, line, message }) => `${code ?? ""} ${line ?? ""}: ${message}`),
    ]),
  );
}

describe("angular output", () => {
  it("passes Angular's compiler, its type check and its linters with no message", async () => {
    const messages = await toolchainMessages([...outputs.values()]);
    expect(Object.values(messages).length).toBe(outputs.size);
    expect(Object.values(messages).flat()).toEqual([]);
  });

  it("passes them for the shapes M2 emits", { timeout: 120_000 }, async () => {
    const files = await Promise.all(
      Object.entries(M2_SOURCES).map(async ([file, source]) => {
        const [output, ...more] = await emitFormatted(lower(source, file, true));
        expect(more).toEqual([]);
        return output!;
      }),
    );
    const messages = await toolchainMessages(files);
    expect(Object.entries(messages).filter(([, found]) => found.length)).toEqual([]);
  });

  // The corpus's committed goldens are this emitter's output as of the last `pnpm test:update`;
  // this judges its output as of now, lowered from each case's source.
  it("passes them for every case of the corpus too", { timeout: 120_000 }, async () => {
    const cases = corpusSources();
    expect(cases.length).toBeGreaterThan(20);
    const files = await Promise.all(
      cases.map(async ({ name, file, source }) =>
        (await emitFormatted(lower(source, file, true))).map((output) => ({
          ...output,
          prefix: `${name.replace(/\//g, "-")}-`,
        })),
      ),
    );
    const messages = await toolchainMessages(files.flat());
    expect(Object.keys(messages).length).toBe(files.flat().length);
    expect(Object.entries(messages).filter(([, found]) => found.length)).toEqual([]);
  });

  it.each([
    {
      name: "Notice",
      props: {},
      html: '<p data-tone="info" data-size="1000">INFO|none|</p>',
    },
    {
      name: "Notice",
      props: { tone: undefined, size: undefined, label: undefined, tags: undefined },
      html: '<p data-tone="info" data-size="1000">INFO|none|</p>',
    },
    {
      name: "Notice",
      props: { tone: "warn", size: 2, label: "a", tags: ["x", "y"] },
      html: '<p data-tone="warn" data-size="2">WARN|a|x,y</p>',
    },
    {
      name: "Owner",
      props: { phone: null, tags: [], value: 1.5 },
      html: "<div><p>no phone</p><p></p><p>1.50</p></div>",
    },
    {
      name: "Owner",
      props: {
        owner: { name: "ada", email: "a@b" },
        phone: " 1 ",
        count: 2,
        tags: ["t"],
        value: "v",
      },
      html: '<div><p>ADA</p><a href="mailto:a@b">3</a><p>1</p><p>2.0</p><p>T</p><p>V</p></div>',
    },
    {
      name: "Rows",
      props: {
        prefix: "#",
        rows: [
          { id: "1", label: "a" },
          { id: "2", label: "b" },
        ],
      },
      html: "<ul><li>#a</li><li>#b</li><li>A</li><li>B</li></ul>",
    },
    {
      name: "Totals",
      props: { values: [1, 3], first: 1, second: 2 },
      html: '<p title="[1,3]" style="width: 1px">3|12|3!|undefined</p>',
    },
    {
      name: "Ranking",
      props: { scores: [2, 9, 4] },
      html: '<ol title="4 9 2"><li>9</li><li>4</li></ol>',
    },
    {
      name: "Spacing",
      props: { on: true, names: ["x", "y"] },
      html: "<div><p><i>a</i> <b>b</b></p><p><i>c</i>\u00a0<b>e</b></p><p><i>x</i><i>y</i> <b>f</b></p><pre><i>g</i> <b>h</b></pre></div>",
    },
    {
      name: "Spacing",
      props: { on: false, names: [] },
      html: "<div><p> <b>b</b></p><p><u>d</u>\u00a0<b>e</b></p><p> <b>f</b></p><pre> <b>h</b></pre></div>",
    },
    {
      name: "Quotes",
      props: { name: 'say "hi"', saved: false },
      html: [
        '<div title="Don\'t forget to save" aria-label="say &quot;hi&quot;\'s results">',
        '<p>Not "saved" yet|Results for "say "hi""|say "hi"it\'s "x"</p>',
        '<p>Visit "https://a.b".  Thanks</p><b>hi</b><ul><li>say "hi"</li></ul>',
        '<p title="none"></p></div>',
      ].join(""),
    },
    {
      name: "Component",
      props: { author: "Ada" },
      html: "<p>By Ada, 1 min</p>",
    },
    {
      name: "Patterns",
      props: { label: "/aa;b)c", on: true },
      html: [
        '<div title="plain"><b>slash</b><i>/aa</i><i>b</i><i>c</i>',
        "<p>x\ue500y/aa;b)c/aa;b)c|named</p>",
        '<svg viewBox="0 0 2 2"><title>/aa;b)c on</title></svg>',
        '<p>set|other</p><p>Visit "https://a.b".  Thanks</p></div>',
      ].join(""),
    },
    {
      name: "Patterns",
      props: { label: "R&D", on: false },
      html: [
        '<div title="plain"><i>R&amp;D</i>',
        "<p>x\ue500yR&amp;DR&amp;D|none</p>",
        '<svg viewBox="0 0 2 2"><title>R&amp;D</title></svg>',
        '<p>set|rd</p><p>Visit "https://a.b".  Thanks</p></div>',
      ].join(""),
    },

    {
      name: "Spreads",
      props: { empty: null, box: {}, rows: [undefined] },
      html: '<div><p>a</p><p class="b">b</p><ul><li>e</li></ul></div>',
    },
    {
      name: "Spreads",
      props: {
        empty: { id: "e" },
        box: { inner: { id: "i", class: "c" } },
        opt: { id: "o", title: "t" },
        rows: [{ id: "r" }],
      },
      html: '<div><p id="e">a</p><p class="b c" id="i">b</p><i id="i" class="c">c</i><b id="o" title="t">d</b><ul><li id="r">e</li></ul></div>',
    },
  ])("renders $name for $props as the source does", async ({ name, props, html }) => {
    expect(canonical(await render(name, props))).toEqual(canonical(html));
  });
});

const rendered = new Map<string, unknown>();
let modules = 0;

/**
 * Compiles a component's output with ngtsc, whose warnings (extended diagnostics) fail it, and
 * renders it on Angular's server platform. Returns what its host element holds; anything
 * Angular logs fails it.
 */
async function render(name: string, props: Record<string, unknown>): Promise<string> {
  const file = outputs.get(name)!;
  let component = rendered.get(name);
  if (!component) {
    const directory = scratchDir();
    const { transform, warnings } = await ngtscPlugin();
    const { code } = await transform(join(directory, `${name}.uf.tsx.ts`), file.contents);
    expect(warnings).toEqual([]);
    const compiledFile = join(directory, `output-${modules++}.js`);
    writeFileSync(compiledFile, code);
    const loaded = (await import(pathToFileURL(compiledFile).href)) as Record<string, unknown>;
    component = loaded.default ?? loaded[name];
    rendered.set(name, component);
  }
  const logged: string[] = [];
  const capture = (...args: unknown[]) => void logged.push(formatMessage(...args));
  const spies = [
    vi.spyOn(console, "error").mockImplementation(capture),
    vi.spyOn(console, "warn").mockImplementation(capture),
  ];
  let html: string;
  try {
    html = await renderToString(component, { props });
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  expect(logged).toEqual([]);
  const selector = /^<(uf-[a-z-]+) style="display: contents;">([\s\S]*)<\/\1>$/.exec(html);
  expect(selector, html).not.toBeNull();
  return selector![2]!;
}
