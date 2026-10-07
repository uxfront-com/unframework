// The render-parity kit's M1 cases, as source: components an author could write, with the props
// they render with. Hand-written ones for each rule of ADR-0034 to ADR-0040 and each spelling
// a printer must guard, root cases whose own root is under test, and a seeded fuzz that writes
// random components. ./render-parity-node.ts lowers them with the analyser, which must accept
// every one, and ./render-parity-reference.ts says what they render.
//
// The values keep to the contract (ADR-0035): unique list keys, dense arrays, finite numbers
// wherever one renders (`NaN` only as a condition), no class token twice on an element, CSS values
// without `;`, no empty, `javascript:` or `data:` URL bound. Values a browser would fetch are
// `about:blank` or fragments, so nothing renders a request.
import type { SourceCase } from "./render-parity.ts";
import { random, TEXT_PIECES } from "./render-parity.ts";

/** A string with markup, references and every template language's delimiters. */
const DELIMITERS =
  "<b>&amp; &lt; {{ x }} }} {#if a} {@html b} @if (c) { ${d} `e` 'f' \"g\" \\h </p>";

/** The hand-written components, each one root element. */
export const TRICKY_SOURCES: readonly SourceCase[] = [
  // Interpolations (ADR-0035): text, as every target escapes it.
  {
    name: "a string with markup and every template's delimiters",
    params: "{ s }: { s: string }",
    jsx: "<p>{s}</p>",
    props: { s: DELIMITERS },
  },
  {
    name: "interpolations beside text with edge and run whitespace",
    params: "{ s, t }: { s: string; t: string }",
    jsx: '<p>{" a  "}{s}{"  b "}x {t}  y{"\\t"}{s}</p>',
    props: { s: " lead  run ", t: "trail\t" },
  },
  {
    name: "numbers",
    params:
      "{ zero, negativeZero, big, fraction, negative, small }: { zero: number; negativeZero: number; big: number; fraction: number; negative: number; small: number }",
    jsx: "<p>{zero} {negativeZero} {big} {fraction} {negative} {small}</p>",
    props: { zero: 0, negativeZero: -0, big: 1e21, fraction: 0.1 + 0.2, negative: -5, small: 1e-7 },
  },
  {
    name: "nullish values beside text, and alone",
    params: "{ n, u }: { n: string | null; u?: string }",
    jsx: "<div><p>a{n}b{u}c</p><p>{n}</p><p>{u}</p></div>",
    props: { n: null },
  },
  {
    name: "empty strings alone and beside text",
    params: "{ e }: { e: string }",
    jsx: "<div><p>{e}</p><p>x{e}y</p><p>{e}{e}</p></div>",
    props: { e: "" },
  },
  {
    name: "whitespace-only strings between elements",
    params:
      "{ space, tab, lineFeed, run }: { space: string; tab: string; lineFeed: string; run: string }",
    jsx: "<p><b>a</b>{space}<i>b</i>{tab}<b>c</b>{lineFeed}<i>d</i>{run}<b>e</b></p>",
    props: { space: " ", tab: "\t", lineFeed: "\n", run: "   " },
  },
  {
    name: "arithmetic, string methods, template literals and globals",
    params: "{ n, s, xs }: { n: number; s: string; xs: string[] }",
    jsx: [
      "<p>",
      "{n * 2 + 1} {s.toUpperCase()} {`${s}-${n}`} {Math.max(n, 3)} ",
      '{String(n).padStart(3, "0")} {n.toFixed(2)} {s.length} {xs.join(", ")} ',
      '{JSON.stringify(s)} {Number("4") / 8} {parseInt("12px", 10)}',
      "</p>",
    ].join(""),
    props: { n: 7, s: "ab", xs: ["x", "y"] },
  },
  {
    // Angular's lexer reads only some escapes and decimal numbers, and no comments: its dialect
    // prints literals again from their values (ADR-0035).
    name: "literal spellings Angular's lexer reads differently, and comments in code",
    params: "{ s, on }: { s: string; on: boolean }",
    jsx: [
      "<p>",
      '{s + "\\x41"}|{on ? "\\u00e9\\t" : \'it\\\'s\'}|{`\\x42${s}\\uD83D\\uDE00`.length}|',
      '{s + "😀" + "\\uD83D\\uDE00"}|{s.length > 0 ? 1e3 : .5}|{1_000 + 0.25}|',
      "{s /* note */}|{/* lead */ s}|{s // line\n}|",
      '{"a\\\\b" + s}|{\'"\' + s + "\'"}',
      "</p>",
    ].join(""),
    props: { s: "z", on: true },
  },
  {
    name: "regular expressions, comparisons and logical operators",
    params: "{ s, n }: { s: string; n: number }",
    jsx: '<p>{/^a/.test(s) ? "yes" : "no"} {n >= 2 && n < 10 ? "mid" : "out"} {n === 3 || s !== "b" ? 1 : 0} {typeof s}</p>',
    props: { s: "abc", n: 3 },
  },
  {
    // Angular's lexers find an interpolation's `}}`, a block's `;` and `)` and a comment's `//`
    // outside quotes, a regular expression's included; its whitespace processing condenses runs
    // there; and a named group's `<` opens a tag in an interpolation.
    name: "regular expressions that hold quotes, `;`, parentheses, slashes, spaces and groups",
    params: "{ s }: { s: string }",
    jsx: [
      `<p title={/'|"/.test(s) ? "quoted" : "plain"}>`,
      `{/'/.test(s) ? "q" : "p"}|{/e  f/.test(s) ? "run" : "none"}|{/^\\//.test(s) ? "slash" : "none"}|`,
      `{s.replace(/[;)]/g, "-")}|{s && /(?<x>e)\\s+(?<!z)f/.test(s) ? "named" : "none"}|`,
      `{/[;)]/.test(s) && <b>block</b>}{s.split(/[;)]/).map((part) => <i key={part}>{part}</i>)}`,
      "</p>",
    ].join(""),
    props: { s: `/a'b"c;d)e  f` },
  },
  {
    // Angular turns U+E500, its `&ngsp;` marker, into a space in text and in interpolated
    // literals, in a `<pre>` too.
    name: "U+E500 in text and in string literals",
    params: "{ s }: { s: string }",
    jsx: '<div><p title={s + "\\ue500"}>x\ue500y{s + "\ue500"}|{"p\\ue500q"}</p><pre>a\ue500 b</pre></div>',
    props: { s: "s\ue500" },
  },
  {
    // Angular decodes an interpolation's references with `/&([^;]+);/`, so a bare `&` would take
    // the `;` of one after it, and its search for a comment knows no escapes, in text it writes
    // as a literal too.
    name: "ampersands before references, and quotes before a `//` in literal text",
    params: "{ s, a, t }: { s: string; a: string; t: string }",
    jsx: [
      '<div title={(a&&s) || "none"}>',
      '<p>{a && /R&D/.test(s) ? "rd" : "other"}|{(a&&t) || "none"}</p>',
      "<p>{'Visit \"https://a.b\".  Thanks'}</p>",
      '<p>Link: {\'"https://a.b"\'} {" "}(copy)</p>',
      "</div>",
    ].join(""),
    props: { s: "R&D", a: "a", t: "t" },
  },
  {
    // Angular's lexer takes every `.` after a number into it, and reads `?.` as optional chaining.
    name: "number literals before a member access, and a leading-dot number after `?`",
    params: "{ s, n, xs }: { s: string; n: number; xs: number[] }",
    jsx: [
      "<div title={0.5.toFixed(2) + s}>",
      "<p>{1.5.toFixed(1)}|{5..toString()}|{1e3.toString()}|{.5.toFixed(1)}|{String(n > 1?.5:1)}</p>",
      "{n.toFixed(1) === 5..toFixed(1) ? <b>five</b> : <i>other</i>}",
      "<ul>{xs.map((x) => <li key={x.toFixed(1) + 1.0.toFixed(0)}>{x}</li>)}</ul>",
      "</div>",
    ].join(""),
    props: { s: "s", n: 5, xs: [1, 2] },
  },
  {
    // angular-eslint lints the raw text of the template literal an Angular template sits in,
    // where a backslash is doubled: no quote, `/`, bracket or parenthesis may follow one.
    name: "apostrophes and quotes in strings, and escaped characters in regular expressions",
    params: "{ name, saved }: { name: string; saved: boolean }",
    jsx: [
      `<div title={saved ? "Saved" : "Don't forget"} aria-label={\`\${name}'s results\`}>`,
      `<p>{saved ? "Saved" : 'Not "saved" yet'}|{\`Results for "\${name}"\`}|{name + "it's \\"x\\""}</p>`,
      `<p>Visit "https://a.b".  Thanks</p>`,
      `{name === 'say "hi"' && <b>hi</b>}`,
      `<ul>{[name, "o'k"].map((x) => <li key={x + "'"}>{x}</li>)}</ul>`,
      `<p title={/a\\/b|[\\]]|\\(/.test(name) ? "match" : "none"}>{/h\\(?i/.test(name) ? "h" : "-"}</p>`,
      "</div>",
    ].join(""),
    props: { name: 'say "hi"', saved: false },
  },
  {
    // Angular's expression lexer reads only ASCII whitespace and the no-break space.
    name: "whitespace outside ASCII between an expression's tokens",
    params: "{ s, on }: { s: string; on: boolean }",
    jsx: "<p title={s +\u3000s}>{s\u2003+ s}{s +\ufeffs}{on\u2028&& <b>on</b>}</p>",
    props: { s: "s", on: true },
  },
  {
    name: "a shorthand property",
    params: "{ s, n }: { s: string; n: number }",
    jsx: "<p>{JSON.stringify({ s, n })}</p>",
    props: { s: "x", n: 1 },
  },
  {
    name: "nullish operators on absent and present props",
    params:
      "{ absent, present, nothing }: { absent?: string; present?: string; nothing: string | null }",
    jsx: '<p>{absent ?? "fallback"}|{present ?? "unused"}|{absent?.length}|{present?.length}|{nothing ?? "null"}</p>',
    props: { present: "here", nothing: null },
  },
  {
    name: "defaults when absent, explicitly undefined and given",
    params:
      '{ absent = "a", undefinedValue = 2, given = "g", flag = false }: { absent?: string; undefinedValue?: number; given?: string; flag?: boolean }',
    jsx: '<p data-flag={flag ? "on" : "off"}>{absent} {undefinedValue} {given}</p>',
    props: { undefinedValue: undefined, given: "given" },
  },
  {
    name: "a null default and null passed",
    params: "{ absent = null, passed = null }: { absent?: string | null; passed?: string | null }",
    jsx: '<p>{absent ?? "none"} {passed ?? "none"}</p>',
    props: { passed: "x" },
  },
  {
    name: "an array and an object default",
    params: '{ xs = ["d1", "d2"], o = { label: "l" } }: { xs?: string[]; o?: { label: string } }',
    jsx: '<p>{xs.join("+")} {o.label}</p>',
  },
  {
    // Vue keeps an optional prop in its pattern for its default, read or not, under a `_` local
    // when nothing reads it; the other targets leave unread props out (ADR-0034).
    name: "props nothing reads, in the pattern or not, with and without defaults",
    params:
      '{ shown, size = 2, on, tags = ["t"] }: { shown: string; hidden: string; size?: number; on?: boolean; note?: string; tags?: string[] }',
    jsx: "<p>{shown}</p>",
    props: { shown: "s", hidden: "h", size: 3, on: true },
  },

  // Conditionals (ADR-0036): truthiness, as v-if decides.
  {
    name: "falsy values that are not booleans render nothing",
    params:
      "{ zero, empty, nan, nothing }: { zero: number; empty: string; nan: number; nothing: string | null }",
    jsx: '<p>[{zero && <b>zero</b>}{empty && "empty"}{nan && <i>nan</i>}{nothing && <u>null</u>}]</p>',
    props: { zero: 0, empty: "", nan: NaN, nothing: null },
  },
  {
    name: "truthy values that are not booleans render their branch",
    params: "{ one, text, negative }: { one: number; text: string; negative: number }",
    jsx: '<p>[{one && <b>one</b>}{text && "text"}{negative && <i>negative</i>}]</p>',
    props: { one: 1, text: "t", negative: -1 },
  },
  ...[0, 1, 2, 3].map((k): SourceCase => ({
    name: `an else-if chain with element, text and multi-node branches (${k})`,
    params: "{ k }: { k: number }",
    jsx: '<p>a{k === 0 ? <b>zero</b> : k === 1 ? "one" : k === 2 ? <><i>two</i> and <b>2</b></> : null}z</p>',
    props: { k },
  })),
  ...[true, false].map((on): SourceCase => ({
    name: `multi-node and text branches at an element's edges (${on})`,
    params: "{ on }: { on: boolean }",
    jsx: '<p>{on ? <>a <b>b</b></> : "c "}x{on ? " y" : <i>z</i>}</p>',
    props: { on },
  })),
  ...[true, false].map((on): SourceCase => ({
    name: `a leading empty branch, and text beside a conditional (${on})`,
    params: "{ on }: { on: boolean }",
    jsx: "<p>a {on ? null : <b>x</b>} b {on && <i>y</i>} c</p>",
    props: { on },
  })),
  ...[1, 2].map((k): SourceCase => ({
    name: `a middle empty branch (${k})`,
    params: "{ k }: { k: number }",
    jsx: "<p>{k === 0 ? <b>0</b> : k === 1 ? null : <i>2</i>}</p>",
    props: { k },
  })),
  {
    name: "nested conditionals, and conditions that need parentheses",
    params: "{ a, b, n }: { a: boolean; b: boolean; n: number }",
    jsx: '<div>{a ? (b ? <b>ab</b> : <i>a</i>) : <u>none</u>}{(a || b) && <s>or</s>}{!(n > 1) ? "small" : "big"}</div>',
    props: { a: true, b: false, n: 2 },
  },
  ...[true, false].map((on): SourceCase => ({
    name: `whitespace in a pre, around a conditional (${on})`,
    params: "{ on, s }: { on: boolean; s: string }",
    jsx: '<pre>a  {on ? " b\\n" : <i>{s}</i>}{"\\tc "}</pre>',
    props: { on, s: " s " },
  })),
  // A line feed after a conditional that always renders an element, which the analyser accepts:
  // one after a conditional that can render nothing is UF3017, as React's and Astro's servers
  // write nothing before it.
  ...[true, false].map((on): SourceCase => ({
    name: `a line feed in a pre after a conditional of elements (${on})`,
    params: "{ on }: { on: boolean }",
    jsx: '<pre>{on ? <b>x</b> : <i>y</i>}{"\\nz"}</pre>',
    props: { on },
  })),
  {
    // For Solid: a line feed between two interpolations in a `<pre>`, which JSX keeps.
    name: "a line feed between interpolations in a pre",
    params: "{ a, b }: { a: string; b: string }",
    jsx: '<pre>{a}{"\\n"}{b}</pre>',
    props: { a: "x", b: "y" },
  },
  {
    name: "block siblings around a conditional",
    params: "{ on }: { on: boolean }",
    jsx: "<div><p>a</p>{on && <p>b</p>}<p>c</p>{on ? <section>d</section> : <div>e</div>}</div>",
    props: { on: true },
  },
  // Branches that read what their condition narrows, as TypeScript narrows it in the source
  // (`user.name` where `user` may be absent): for Solid, whose output reads them through
  // `<Show>`'s and `<Match>`'s callbacks. An `&&`, a ternary, a negation that narrows the rest of
  // a chain, a property, the left of an `&&`, and an else-if on another reference.
  ...[
    { user: { name: "Ada", admin: true, address: { city: "London" } } },
    { user: { name: "Bo" }, note: null },
    { note: " n " },
  ].map((props, k): SourceCase => ({
    name: `an optional object its conditions narrow (${k})`,
    params:
      "{ user, note }: { user?: { name: string; admin?: boolean; address?: { city: string } }; note?: string | null }",
    jsx: [
      "<div>",
      "{user && <p>{user.name}</p>}",
      "{user ? <b title={user.name}>{user.name}</b> : <i>anon</i>}",
      "{!user ? <i>none</i> : user.admin ? <b>{user.name}</b> : <u>{user.name}</u>}",
      "{user && user.address && <p>{user.address.city}</p>}",
      "{user && user.admin && <s>{user.name}</s>}",
      "{user ? <em>{user.name}</em> : note ? <em>{note.trim()}</em> : null}",
      "</div>",
    ].join(""),
    props,
  })),
  {
    name: "a list's nullable items its conditions narrow",
    params: "{ rows }: { rows: ({ id: string; label: string } | null)[] }",
    jsx: '<ul>{rows.map((row, index) => <li key={index}>{row && row.label}{row ? <b>{row.id}</b> : "-"}</li>)}</ul>',
    props: { rows: [{ id: "a", label: "A" }, null, { id: "c", label: "" }] },
  },
  // Comparisons, `typeof` and a discriminant, which Solid's output narrows through an object its
  // `<Show>` or `<Match>` tests, and an else that needs the failed test's narrowing.
  ...[
    { count: 2.5, note: " n ", value: "abc", shape: { kind: "circle", r: 2 }, items: ["x"] },
    { count: 0, note: null, value: 1.25, shape: { kind: "square", side: 3 }, items: ["x", "y"] },
    { value: "", shape: { kind: "circle", r: 0 }, items: [] },
  ].map((props, k): SourceCase => ({
    name: `references its comparisons and \`typeof\` narrow (${k})`,
    params:
      '{ count, note, value, shape, items }: { count?: number; note?: string | null; value: string | number; shape: { kind: "circle"; r: number } | { kind: "square"; side: number }; items: string[] }',
    jsx: [
      "<div>",
      "{count !== undefined && count > 0 && <b title={String(count)}>{count.toFixed(1)}</b>}",
      "{count === undefined ? <i>none</i> : <u>{count.toFixed(2)}</u>}",
      "{note != null && <em title={note}>{note.trim()}</em>}",
      '{typeof value === "string" ? <b>{value.toUpperCase()}</b> : <i>{value.toFixed(1)}</i>}',
      '{shape.kind === "circle" ? <s data-r={shape.r}>c</s> : <s data-side={shape.side}>s</s>}',
      "{count !== undefined && <ul>{items.map((item) => <li key={item}>{item}</li>)}<li>{count.toFixed(0)}</li></ul>}",
      "</div>",
    ].join(""),
    props,
  })),
  // What Solid's keyed callbacks must take as the source reads it: a union with a falsy literal
  // its truthiness test removes, a chain `typeof … !== "undefined"` runs to its end, an else
  // that reads through `?.` what its test reads only where it holds, a path a callback around
  // gives at more length, a template-literal key, and a branch of one interpolation.
  ...[
    {
      limit: 2.5,
      rows: [0, { n: 1 }],
      box: { inner: { title: "long", other: " o " }, name: " b " },
      label: "!",
      user: { nick: " k " },
    },
    { limit: "", rows: [], box: { inner: { title: "t" } }, label: "", user: {} },
    { limit: 0.5, rows: [{ n: 0 }], box: {}, label: "?", user: { nick: "" } },
  ].map((props, k): SourceCase => ({
    name: `values Solid's keyed callbacks take as the source reads them (${k})`,
    params:
      '{ limit, rows, box, label, user }: { limit: number | ""; rows: (0 | { n: number })[]; box: { inner?: { title: string; other?: string }; name?: string }; label: string; user: { nick?: string } }',
    jsx: [
      "<div>",
      "{limit && <p>{limit.toFixed(1)}</p>}",
      "{!limit ? <i>none</i> : <b>{limit.toFixed(0)}</b>}",
      "<ul>{rows.map((row, index) => <li key={index}>{row && <b>{row.n}</b>}</li>)}</ul>",
      '{typeof box.inner?.other !== "undefined" && <p>{box.inner.other.trim()}</p>}',
      '{typeof box.inner?.other === "undefined" ? <i>none</i> : <b>{box.inner.other.trim()}</b>}',
      '{box.inner && box.inner.title.length > 3 ? <p>{box.inner.title}</p> : <p>{box.inner?.title ?? "anon"}</p>}',
      "{box.name && <p>{box.name}{box.inner && <b>{box.inner.title}{box.name}</b>}</p>}",
      "{user[`nick`] && <p>{user[`nick`].trim()}</p>}",
      "<p>{box.name && box.name.trim() + label}</p>",
      "</div>",
    ].join(""),
    props,
  })),
  {
    name: "array defaults of literal-union values",
    params:
      '{ tones = ["info"], sizes = [1, 2], tone, size }: { tones?: ("info" | "warn")[]; sizes?: (1 | 2 | 3)[]; tone: "info" | "warn"; size: 1 | 2 | 3 }',
    jsx: '<p>{tones.includes(tone) ? "y" : "n"} {sizes.indexOf(size)}</p>',
    props: { tone: "warn", size: 2 },
  },

  // Lists (ADR-0036): content and order.
  {
    name: "a keyed list of objects",
    params: "{ items }: { items: { id: string; label: string }[] }",
    jsx: "<ul>{items.map((item) => <li key={item.id}>{item.label}</li>)}</ul>",
    props: {
      items: [
        { id: "a", label: "Alpha" },
        { id: "b", label: " Beta " },
        { id: "c", label: "{{ gamma }}" },
      ],
    },
  },
  {
    name: "an indexed list, with the index in text",
    params: "{ xs }: { xs: string[] }",
    jsx: "<ol>{xs.map((x, index) => <li key={index}>{index}: {x}</li>)}</ol>",
    props: { xs: ["a", "a", " "] },
  },
  {
    name: "an index read only by the key",
    params: "{ xs }: { xs: string[] }",
    jsx: "<ul>{xs.map((x, index) => <li key={index}>{x}</li>)}</ul>",
    props: { xs: ["x", "y"] },
  },
  {
    name: "an empty list beside a nothing-here branch",
    params: "{ xs }: { xs: string[] }",
    jsx: "<div><ul>{xs.map((x) => <li key={x}>{x}</li>)}</ul>{xs.length === 0 && <p>Nothing here</p>}</div>",
    props: { xs: [] },
  },
  {
    name: "nested lists, a conditional in a list and a list in a conditional",
    params:
      "{ groups, on }: { groups: { name: string; items: { id: string; on: boolean }[] }[]; on: boolean }",
    jsx: [
      "<div>",
      "{on && <ul>{groups.map((group) => <li key={group.name}>{group.name}",
      "<ol>{group.items.map((item) => <li key={item.id}>{item.on ? <b>{item.id}</b> : item.id}</li>)}</ol>",
      "</li>)}</ul>}",
      "</div>",
    ].join(""),
    props: {
      on: true,
      groups: [
        {
          name: "g1",
          items: [
            { id: "a", on: true },
            { id: "b", on: false },
          ],
        },
        { name: "g2", items: [] },
        { name: "g3", items: [{ id: "c", on: false }] },
      ],
    },
  },
  {
    name: "rows of a table",
    params: "{ rows }: { rows: { id: number; a: string; b: number }[] }",
    jsx: "<table><tbody>{rows.map((row) => <tr key={row.id}><td>{row.a}</td><td>{row.b}</td></tr>)}</tbody></table>",
    props: {
      rows: [
        { id: 1, a: "x", b: 0 },
        { id: 2, a: "", b: -0 },
      ],
    },
  },
  {
    name: "options of a select, from a list",
    params: "{ options }: { options: string[] }",
    jsx: "<select>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>",
    props: { options: ["one", "two"] },
  },
  {
    name: "a list over a filtered source, beside text",
    params: "{ xs }: { xs: string[] }",
    jsx: "<p>a{xs.filter((x) => x.length > 1).map((x) => <b key={x}>{x}</b>)}b</p>",
    props: { xs: ["a", "bb", "c", "dd"] },
  },
  {
    name: "a list of numbers keyed by value",
    params: "{ ns }: { ns: number[] }",
    jsx: "<p>{ns.map((n) => <i key={n}>{n * 2}</i>)}</p>",
    props: { ns: [3, 1, 2] },
  },
  {
    name: "a list whose items are spread",
    params: '{ items }: { items: { title: string; "data-x"?: string }[] }',
    jsx: "<ul>{items.map((item) => <li key={item.title} {...item}>x</li>)}</ul>",
    props: { items: [{ title: "a", "data-x": "1" }, { title: "b" }] },
  },

  // Bound attributes (ADR-0037).
  {
    name: "strings, numbers, nullish and empty values",
    params:
      "{ s, n, nothing, absent, e }: { s: string; n: number; nothing: string | null; absent?: string; e: string }",
    jsx: "<p title={s} data-x={n} data-n={nothing} data-u={absent} data-e={e} aria-label={s}>x</p>",
    props: { s: DELIMITERS, n: 0, nothing: null, e: "" },
  },
  ...[true, false].map((on): SourceCase => ({
    name: `bindable boolean attributes (${on})`,
    params: "{ on }: { on: boolean }",
    jsx: [
      "<form>",
      "<input disabled={on} readonly={on} required={on} />",
      "<details open={on}><summary>s</summary>d</details>",
      "<button disabled={on} formnovalidate={on}>b</button>",
      "<ol reversed={on}><li>a</li></ol>",
      "<textarea disabled={on}>t</textarea>",
      "</form>",
    ].join(""),
    props: { on },
  })),
  {
    name: "ARIA and other attributes that render booleans as text",
    params: '{ on, off, mode }: { on: boolean; off: boolean; mode: "true" | "false" }',
    jsx: '<div aria-hidden={on} aria-expanded={off} draggable={on} spellcheck={off} aria-label={on ? "yes" : "no"}>x<span contenteditable={mode} /></div>',
    props: { on: true, off: false, mode: "false" },
  },
  {
    name: "number-typed attributes",
    params: "{ n, zero }: { n: number; zero: number }",
    jsx: [
      "<div tabindex={zero}>",
      "<table><tbody><tr><td colspan={n} rowspan={n}>c</td></tr></tbody></table>",
      "<textarea rows={n} cols={n} maxlength={n}>t</textarea>",
      "<ol start={n}><li>a</li></ol><input size={n} maxlength={n} />",
      "</div>",
    ].join(""),
    props: { n: 2, zero: 0 },
  },
  {
    name: "URL attributes",
    params: "{ href, src, alt }: { href: string; src: string; alt: string }",
    jsx: "<div><a href={href}>a</a><img src={src} alt={alt} /><form action={href}>f</form></div>",
    props: { href: "/docs?x=1&y=2#top", src: "about:blank", alt: DELIMITERS },
  },
  {
    name: "bound values that need parentheses",
    params: "{ on, s, n }: { on: boolean; s: string; n: number }",
    jsx: '<p title={on ? "x" : "y"} data-x={s + "!"} data-n={n + 1} aria-label={`${s} ${n}`}>p</p>',
    props: { on: false, s: "s", n: 1 },
  },
  {
    // For Solid: a quote and an ampersand in string literals of a bound value.
    name: "a quote and an ampersand in a bound value's literals",
    params: "{ on, off }: { on: boolean; off: boolean }",
    jsx: `<div><p title={on ? '"' : "&"}>x</p><p title={off ? '"' : "&"}>y</p></div>`,
    props: { on: true, off: false },
  },
  {
    name: "a bound type and value on a button",
    params: '{ type, value }: { type: "button" | "submit"; value: string }',
    jsx: '<form><button type={type} name="n" value={value}>b</button></form>',
    props: { type: "button", value: "v  w" },
  },
  {
    // A `value` that equals the element's own default (`li.value` is 0, `button.value` is "",
    // a checkbox's is "on"), which Svelte's `set_value` skipped writing.
    name: "bound values equal to the element's own default",
    params:
      "{ zero, empty, on, three }: { zero: number; empty: string; on: string; three: number }",
    jsx: [
      "<form>",
      "<ol><li value={zero}>a</li><li value={three}>b</li></ol>",
      '<meter min="0" max="10" value={zero}>m</meter>',
      '<progress max="10" value={zero}>p</progress>',
      "<data value={empty}>d</data>",
      '<button type="button" value={empty}>b</button>',
      '<input type="hidden" name="h" value={empty} />',
      '<input type="checkbox" name="c" value={on} />',
      "</form>",
    ].join(""),
    props: { zero: 0, empty: "", on: "on", three: 3 },
  },

  // Class (ADR-0038).
  {
    name: "a dynamic class beside a static name",
    params: "{ tone }: { tone: string }",
    jsx: '<p class={["card", tone]}>x</p>',
    props: { tone: "warn" },
  },
  ...[true, false].map((on): SourceCase => ({
    name: `toggles, with names that are not identifiers (${on})`,
    params: "{ on, off }: { on: boolean; off: boolean }",
    jsx: '<p class={{ active: on, "is-off": off, "w-1/2": on, "md:flex": !on }}>x</p>',
    props: { on, off: !on },
  })),
  {
    name: "toggles that are all false",
    params: "{ off }: { off: boolean }",
    jsx: "<p class={{ a: off, b: off }}>x</p>",
    props: { off: false },
  },
  {
    name: "an array of strings, toggles and template literals",
    params: "{ on, off, tone }: { on: boolean; off: boolean; tone: string }",
    jsx: '<p class={["a", on && "b c", `t-${tone}`, { d: off, e: on }, off && "f"]}>x</p>',
    props: { on: true, off: false, tone: "x" },
  },
  {
    name: "nullish, empty and spaced dynamic classes",
    params:
      "{ nothing, e, spaced, absent }: { nothing: string | null; e: string; spaced: string; absent?: string }",
    jsx: '<div><p class={["a", nothing, e]}>x</p><p class={absent}>y</p><p class={spaced}>z</p><p class={e}>w</p></div>',
    props: { nothing: null, e: "", spaced: "  p\tq \n r  " },
  },
  {
    name: "a conditional dynamic class",
    params: "{ on }: { on: boolean }",
    jsx: '<p class={on ? "x y" : "z"}>x</p>',
    props: { on: true },
  },
  {
    name: "class names that hold a template's delimiters",
    params: "{ tone }: { tone: string }",
    jsx: '<p class={["{{a}}", "@b", tone]}>x</p>',
    props: { tone: "{c}" },
  },

  // Style (ADR-0038).
  {
    name: "a static style",
    jsx: '<p style="color: red; margin-top: 4px; --gap: 2px">x</p>',
  },
  {
    name: "camelCase, custom properties, unitless numbers and bound values",
    params:
      "{ color, gap, height, opacity, z }: { color: string; gap: string; height: number; opacity: number; z: number }",
    jsx: '<p style={{ color, marginTop: "4px", "--gap": gap, lineHeight: height, opacity, zIndex: z, "--n": z }}>x</p>',
    props: { color: "rgb(1, 2, 3)", gap: "1em", height: 1.5, opacity: 0.5, z: 2 },
  },
  {
    name: "nullish and empty declarations are left out",
    params: "{ absent, e }: { absent?: string; e: string }",
    jsx: '<div><p style={{ color: absent, marginTop: e, paddingLeft: "2px" }}>x</p><p style={{ color: absent }}>y</p></div>',
    props: { e: "" },
  },
  {
    name: "a bound declaration before a static one",
    params: "{ gap }: { gap: string }",
    jsx: '<p style={{ margin: gap, color: "red" }}>x</p>',
    props: { gap: "1px" },
  },
  {
    name: "a static style value with a template's delimiters",
    params: "{ tone }: { tone: string }",
    jsx: '<p class={["{{a}}", tone]} style="content: &quot;{{ x }} {y} @if&quot;; color: red">x</p>',
    props: { tone: "t" },
  },
  {
    // Svelte's server renders a `style:` directive through its runtime, which escaped a static
    // value twice (`&quot;` rendered `&amp;quot;`).
    name: "static declarations with quotes, an ampersand and a `<` beside a bound one",
    params: "{ tone }: { tone: string }",
    jsx: `<p style={{ fontFamily: '"Segoe UI", serif', "--label": '"a & <b>"', color: tone }}>x</p>`,
    props: { tone: "red" },
  },
  {
    // Svelte writes `autocorrect` outside an `<input>` as an object spread, and its server
    // renders every attribute of an element with a spread through its runtime, as it does an
    // `<option>`'s, which escaped their static values twice.
    name: "static values with quotes, an ampersand and a `<` beside an attribute Svelte spreads",
    jsx: [
      "<div>",
      `<p autocorrect="off" title='Name & "title" <x>' class="q&r" style='content: "&"'>x</p>`,
      `<select autocorrect="off" name="s" title='"s" & t'><option value='a & "b"' title="<o>">a</option></select>`,
      "</div>",
    ].join(""),
  },
  {
    // Vue's compiler parses a static `style` again, knowing no strings: it splits at a `;` in
    // one, not before a value whose first parenthesis is a `)`, and it removes comments.
    name: "static style values that Vue's style parser misreads",
    params: "{ c }: { c: string }",
    jsx: [
      "<div>",
      `<p style='font-family: "A;B", serif; color: red'>a</p>`,
      `<p style='margin: 0; content: ")" "("'>b</p>`,
      `<p style="content: 'x;y'; margin: 1px/**/2px">c</p>`,
      `<p style={{ fontFamily: '"C;D", serif', color: c }}>d</p>`,
      "</div>",
    ].join(""),
    props: { c: "blue" },
  },

  // Spreads (ADR-0039).
  {
    name: "a spread beside written attributes, its class merged",
    types:
      'interface TrickyAttrs {\n  title?: string;\n  "data-x"?: string;\n  "aria-label"?: string;\n  class?: string;\n}',
    params: "{ attrs }: { attrs: TrickyAttrs }",
    jsx: '<p {...attrs} class="a" id="p1">x</p>',
    props: { attrs: { title: "t", "data-x": "1", class: "s  u" } },
  },
  {
    name: "an optional spread source, absent and present",
    types: 'interface TrickyOptional {\n  title?: string;\n  "data-x"?: string;\n}',
    params: "{ absent, present }: { absent?: TrickyOptional; present?: TrickyOptional }",
    jsx: "<div><p {...absent}>a</p><p {...present}>b</p></div>",
    props: { present: { "data-x": "d" } },
  },
  {
    name: "two spreads, a boolean key and a class merged into a dynamic class",
    types:
      'type TrickyButton = { disabled?: boolean; type?: "button" | "reset" };\ntype TrickyLabel = { title?: string; class?: string };',
    params: "{ button, label, tone }: { button: TrickyButton; label: TrickyLabel; tone: string }",
    jsx: '<button {...button} {...label} class={["b", tone]}>x</button>',
    props: { button: { disabled: true, type: "button" }, label: { class: "l" }, tone: "t" },
  },
  // A source of any form that may be nullish reads its keys through `?.`, and spreads nothing
  // when it is; one a condition narrows reads them through `.` (the spread's `nullish`).
  ...[false, true].map((present): SourceCase => ({
    name: `spreads of sources that may be nullish (${present ? "present" : "absent"})`,
    params: [
      "{ empty, box, on, attrs, xs, fallback = null }: {",
      ' empty: { title?: string; "data-x"?: string } | null;',
      " box: { inner?: { title?: string; class?: string } };",
      " on: boolean;",
      " attrs: { title?: string; class?: string };",
      ' xs: { "data-x"?: string }[];',
      " fallback?: { title?: string } | null }",
    ].join(""),
    jsx: [
      "<div>",
      "<p {...empty}>a</p>",
      '<p class="b" {...box.inner}>b</p>',
      "<p {...(on ? attrs : undefined)}>c</p>",
      "<p {...(on ? undefined : attrs)}>d</p>",
      "<p {...xs[1]}>e</p>",
      "<p {...fallback}>f</p>",
      "</div>",
    ].join(""),
    props: present
      ? {
          empty: { title: "t", "data-x": "1" },
          box: { inner: { title: "i", class: "c" } },
          on: true,
          attrs: { title: "a", class: "k" },
          xs: [{ "data-x": "0" }, { "data-x": "1" }],
          fallback: { title: "f" },
        }
      : { empty: null, box: {}, on: false, attrs: { title: "a", class: "k" }, xs: [] },
  })),
  ...[false, true].map((present): SourceCase => ({
    name: `spreads of a list's items and of narrowed sources (${present ? "present" : "absent"})`,
    params: [
      "{ rows, opt, box, on }: {",
      " rows: ({ title?: string; class?: string } | undefined)[];",
      " opt?: { title?: string };",
      " box: { inner?: { title?: string; class?: string } };",
      " on: boolean }",
    ].join(""),
    jsx: [
      "<div>",
      '<ul>{rows.map((row, i) => <li key={i} class="r" {...row}>x</li>)}</ul>',
      "{opt && <p {...opt}>a</p>}",
      '{!box.inner ? <i>n</i> : <p class="y" {...box.inner}>b</p>}',
      "{on && opt ? <b {...opt}>c</b> : <u {...opt}>d</u>}",
      "</div>",
    ].join(""),
    props: present
      ? {
          rows: [{ title: "t", class: "c" }, undefined],
          opt: { title: "o" },
          box: { inner: { title: "i", class: "z" } },
          on: true,
        }
      : { rows: [undefined], box: {}, on: false },
  })),

  // SVG (ADR-0040).
  {
    name: "an icon, with a title, a list and a gradient",
    params: "{ label, xs, r, width }: { label: string; xs: number[]; r: number; width: string }",
    jsx: [
      '<div><svg viewBox="0 0 24 24" role="img" aria-labelledby="icon-title">',
      '<title id="icon-title">{label}</title>',
      '<circle cx="12" cy="12" r={r} stroke-width={width} fill="none" />',
      '<g>{xs.map((x) => <rect key={x} x={x} y="0" width="1" height="1" />)}</g>',
      '<linearGradient id="gradient" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="red" /></linearGradient>',
      '<path d="M0 0 L 10 10" stroke="url(#gradient)" />',
      "</svg></div>",
    ].join(""),
    props: { label: "Icon <&>", xs: [1, 3], r: 4, width: "2" },
  },
  {
    name: "text in SVG",
    params: "{ s, on }: { s: string; on: boolean }",
    jsx: '<svg viewBox="0 0 100 20"><text x="0" y="10">{s} <tspan font-weight="bold">{s}</tspan>{on && " on"}</text></svg>',
    props: { s: "a  b", on: true },
  },
  {
    // React's server renderer writes a <title> whose children are an array as empty: its
    // output joins them into one string, which must escape and keep what the parts render.
    // Angular's lexer reads a <title> as text, an `@if` in it included, unless it is written
    // `<svg:title>`.
    name: "SVG titles of several parts, in a branch and a list",
    params:
      "{ label, s, n, u, count, on, off, xs }: { label: string; s: string; n: string | null; u?: string; count: number; on: boolean; off: boolean; xs: string[] }",
    jsx: [
      '<svg viewBox="0 0 10 10">',
      "<g><title>{label} icon</title></g>",
      "<g><title>a{n}b{u}c{count}{label}</title></g>",
      '<g><title>{"`${x}` \\\\ "}{s} \\ `{label}`</title></g>',
      "{on && <g><title>{label} shown</title></g>}",
      "{xs.map((x) => <g key={x}><title>Item {x}</title></g>)}",
      '<g><title>{on && " on"}{off ? "x" : <>y {label}</>}{on ? <>{count} of {n}</> : null}</title></g>',
      '<g><title>[{count === 0 ? "none" : count === 1 ? <>one {label}</> : <>{count}: {u}</>}]</title></g>',
      '<g><title>{on ? <>On: {u}</> : "Off"}</title></g>',
      "</svg>",
    ].join(""),
    props: {
      label: "Star <&>",
      s: DELIMITERS,
      n: null,
      count: 0,
      on: true,
      off: false,
      xs: ["a", "b"],
    },
  },
  {
    name: "a style and a class in SVG",
    params: "{ fill, on }: { fill: string; on: boolean }",
    jsx: '<svg viewBox="0 0 2 2"><rect width="2" height="2" style={{ fill }} class={{ on }} /></svg>',
    props: { fill: "blue", on: true },
  },
];

/** Components whose own root is under test, each rendered as a component of its own. */
export const ROOT_SOURCES: readonly SourceCase[] = [
  {
    name: "text and interpolations at a root fragment's edges",
    params: "{ s }: { s: string }",
    jsx: '<>a <b>b</b>{s} <i>c</i>{s}{" z "}</>',
    props: { s: "S" },
  },
  {
    name: "interpolations at both edges",
    params: "{ s }: { s: string }",
    jsx: "<>{s}<p>x</p>{s}</>",
    props: { s: " S " },
  },
  {
    name: "whitespace at both edges",
    jsx: '<>{" "}<b>x</b>{"\\n"}</>',
  },
  {
    name: "a conditional, a list and a block at the root",
    params: "{ on, xs }: { on: boolean; xs: string[] }",
    jsx: "<>{on && <h1>T</h1>}<ul>{xs.map((x) => <li key={x}>{x}</li>)}</ul><p>end</p></>",
    props: { on: true, xs: ["x", "y"] },
  },
  ...[0, 1, 2].map((k): SourceCase => ({
    name: `an else-if chain at the root (${k})`,
    params: "{ k }: { k: number }",
    jsx: '<>{k === 0 ? "zero" : k === 1 ? <b>one</b> : <><i>two</i> 2</>}</>',
    props: { k },
  })),
  {
    name: "a list at the root",
    params: "{ xs }: { xs: string[] }",
    jsx: "<>{xs.map((x) => <p key={x}>{x}</p>)}</>",
    props: { xs: ["a", "b"] },
  },
  {
    name: "an interpolation alone",
    params: "{ s }: { s: string }",
    jsx: "<>{s}</>",
    props: { s: "alone" },
  },
  {
    name: "a conditional that renders nothing",
    params: "{ on }: { on: boolean }",
    jsx: "<>{on && <p>x</p>}</>",
    props: { on: false },
  },
  {
    name: "an element with bound attributes",
    params: "{ s, on }: { s: string; on: boolean }",
    jsx: '<p class={{ on }} title={s} style={{ color: "red" }}>{s}</p>',
    props: { s: "t", on: true },
  },
  {
    name: "an svg",
    params: "{ r }: { r: number }",
    jsx: '<svg viewBox="0 0 2 2"><circle cx="1" cy="1" r={r} /></svg>',
    props: { r: 1 },
  },
];

/** The seeds of the random components, and of the random roots. */
export const FUZZ_SOURCE_SEEDS: readonly number[] = Array.from({ length: 60 }, (_, i) => i + 1);
export const ROOT_SOURCE_SEEDS: readonly number[] = Array.from({ length: 8 }, (_, i) => i + 101);

/** Options for {@link fuzzSource}. */
export interface FuzzSourceOptions {
  /** Whether the component's own root is under test: a fragment of random nodes. */
  root?: boolean;
  /** How the suite reads props: a props object takes no default (ADR-0001). */
  form?: "destructured" | "object";
}

/** A prop the random component declares. */
interface FuzzProp {
  name: string;
  type: string;
  /** The value passed; `absent` leaves the key out. */
  value: unknown;
  absent?: boolean;
  /** The default's source, destructured form only. */
  defaultCode?: string;
  /** Declared optional though a value is passed. */
  optional?: boolean;
}

/** Characters raw JSX text keeps exactly as written, on one line, in every JSX reader. */
const PLAIN_TEXT = /^[A-Za-z0-9 .,:;!?'"=+*/|@#%^~_-]*$/;

/** Static class names, toggles and dynamic tokens, from separate pools so none repeats. */
const STATIC_CLASSES = ["a", "b c", "card card--wide", "@y", "w-1/3"];
const TOGGLE_CLASSES = ["on", "is-active", "w-1/2", "md:flex", "x_y"];

/** CSS properties no two of which overlap, with values every target renders as written. */
const STYLE_PROPERTIES: readonly {
  property: string;
  key: string;
  values: readonly string[];
  numbers?: readonly number[];
}[] = [
  { property: "color", key: "color", values: ["red", "rgb(1, 2, 3)", "#00f"] },
  { property: "background-color", key: "backgroundColor", values: ["white", "rgba(0, 0, 0, 0.5)"] },
  { property: "margin-top", key: "marginTop", values: ["4px", "1em", "0px"] },
  { property: "padding-left", key: "paddingLeft", values: ["2px", "10%"] },
  { property: "width", key: "width", values: ["10px", "50%"] },
  { property: "line-height", key: "lineHeight", values: ["2", "1.5"], numbers: [1.5, 2] },
  { property: "opacity", key: "opacity", values: ["0.25"], numbers: [0.5, 1] },
  { property: "z-index", key: "zIndex", values: ["3"], numbers: [2, -1] },
  { property: "font-weight", key: "fontWeight", values: ["bold"], numbers: [700] },
  { property: "text-align", key: "textAlign", values: ["center", "right"] },
  { property: "--gap", key: '"--gap"', values: ["4px", "a b"], numbers: [3] },
  { property: "--label", key: '"--label"', values: ["x", "{{ y }}"] },
];

/** Elements that hold flow content: blocks, phrasing and text. */
const FLOW = ["div", "section"];
/** Block-level children of flow content. */
const BLOCKS = ["div", "section", "p", "pre", "ul", "ol", "table", "svg"];
/** Phrasing elements that hold phrasing content. */
const INLINES = ["span", "b", "i", "em", "a", "label", "button"];
/** Phrasing elements with no children, or text only. */
const LEAVES = ["br", "img", "input", "select", "textarea"];
/** Interactive content, which HTML does not nest. */
const INTERACTIVE = new Set(["a", "label", "button", "input", "select", "textarea"]);
/** Elements whose content is phrasing: a `<p>` inside one would be moved by the parser. */
const PHRASING_PARENTS = new Set(["p", "span", "b", "i", "em", "a", "label", "button", "pre"]);

/**
 * A random component, from a seed (P8): its props and the values it renders with, and JSX of
 * every M1 kind. Text, from the pieces printers must guard, is raw JSX text where
 * JSX keeps it as written and a string literal elsewhere; interpolations of strings and numbers
 * (`0`, `-0`, `1e21`, `1e-7`) sit beside text; conditionals with falsy values
 * that are not booleans, chains, text and several nodes in a branch at an element's edges; keyed,
 * indexed, empty and nested lists; bound attributes of each kind; `class` and `style` in each
 * form; spreads, some optional; SVG. It keeps to the nesting the analyser accepts and the values
 * the contract covers. With `root`, the component's root is a fragment of such nodes.
 */
export function fuzzSource(seed: number, options: FuzzSourceOptions = {}): SourceCase {
  const next = random(seed * 7919 + (options.root ? 1 : 0) + (options.form === "object" ? 2 : 0));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  const chance = (probability: number) => next() < probability;
  const variant = options.root ? "R" : options.form === "object" ? "O" : "F";
  const prefix = `${variant}${seed}`;
  const defaults = options.form !== "object";
  const props: FuzzProp[] = [];
  const types: string[] = [];
  let tokens = 0;
  let keys = 0;

  /** A random string from the pieces printers must guard, never starting with a line feed. */
  const text = (min = 1) =>
    Array.from({ length: min + Math.floor(next() * 3) }, () => pick(TEXT_PIECES))
      .join("")
      .replace(/^\n+/, "");

  /** Declares a prop and returns its name. */
  const declare = (stem: string, type: string, value: unknown, extra: Partial<FuzzProp> = {}) => {
    const name = `${stem}${props.length}`;
    props.push({ name, type, value, ...extra });
    return name;
  };
  const stringProp = (value = text()) => declare("s", "string", value);
  const numberProp = (value: number) => declare("n", "number", value);
  const booleanProp = (value = chance(0.5)) => declare("b", "boolean", value);
  /** An optional string, absent, explicitly undefined or given; with a default, sometimes. */
  const optionalProp = () => {
    const how = pick(["absent", "undefined", "given"] as const);
    const withDefault = defaults && chance(0.4);
    return declare("o", "string", how === "given" ? text() : undefined, {
      optional: true,
      ...(how === "absent" ? { absent: true } : {}),
      ...(withDefault ? { defaultCode: JSON.stringify(text()) } : {}),
    });
  };
  /** A nullable string (`string | null`), null or given. */
  const nullableProp = () => declare("u", "string | null", chance(0.5) ? null : text());

  /** A JSX child that renders `value` exactly: raw text where JSX keeps it, else a literal. */
  const textChild = (value: string) =>
    PLAIN_TEXT.test(value) && value.trim() === value && chance(0.5)
      ? value
      : `{${JSON.stringify(value)}}`;

  /** An interpolation: an expression of string or number kinds, and what it reads. */
  function interpolation(): string {
    switch (Math.floor(next() * 9)) {
      case 0:
        return `{${stringProp()}}`;
      case 1:
        return `{${numberProp(pick([0, -0, 1e21, 2.5, -3, 0.1 + 0.2, 1e-7]))}}`;
      case 2:
        return `{${stringProp()} + ${pick(['"\\x41"', '"!"', '" & "', "'{{'", '"\\u00e9"'])}}`;
      case 3:
        return `{\`\${${stringProp()}}|\${${numberProp(pick([1, 0]))}}\`}`;
      case 4: {
        const name = optionalProp();
        const prop = props.find((each) => each.name === name)!;
        // `??` only where the value can be nullish: a default rules it out (UF3023).
        return prop.defaultCode ? `{${name}}` : `{${name} ?? ${JSON.stringify(text())}}`;
      }
      case 5:
        return `{${nullableProp()}}`;
      case 6:
        return `{${booleanProp()} ? ${JSON.stringify(text())} : ${pick(["0", '""', "null"])}}`;
      case 7:
        return `{${stringProp()}.toUpperCase().length * ${pick(["2", "0.5", "1e3"])}}`;
      default:
        return `{Math.max(${numberProp(pick([1, 4]))}, 2) + ${JSON.stringify(text())}}`;
    }
  }

  /** A condition, truthy or falsy at random, of boolean, number, string or optional kinds. */
  function condition(): string {
    switch (Math.floor(next() * 6)) {
      case 0:
        return booleanProp();
      case 1:
        return `!${booleanProp()}`;
      case 2:
        // `NaN` only here: rendered, a non-finite number is outside the contract (ADR-0035).
        return numberProp(pick([0, 1, 2, Number.NaN]));
      case 3:
        return stringProp(pick(["", "x"]));
      case 4: {
        const name = optionalProp();
        return props.find((each) => each.name === name)!.defaultCode ? `${name} === "x"` : name;
      }
      default:
        return `${numberProp(pick([0, 3]))} > 1`;
    }
  }

  /** Where an element sits: what it may contain is decided by these. */
  interface Place {
    depth: number;
    interactive: boolean;
  }

  /** Global attributes and the element's own, static and bound, `class`, `style`, a spread. */
  function attributes(tag: string, svg: boolean): string {
    const written: string[] = [];
    const names = new Set<string>();
    const add = (name: string, source: string) => {
      if (names.has(name)) return;
      names.add(name);
      written.push(source);
    };
    if (svg) {
      svgAttributes(tag, add);
    } else {
      if (chance(0.2)) add("title", chance(0.5) ? `title={${stringProp()}}` : `title="t${seed}"`);
      if (chance(0.15)) add("data-x", `data-x={${pick([stringProp(), numberProp(pick([0, 7]))])}}`);
      if (chance(0.1)) add("aria-label", `aria-label={${stringProp()}}`);
      if (chance(0.1)) add("aria-hidden", `aria-hidden={${booleanProp()}}`);
      if (chance(0.05)) add("tabindex", `tabindex={${numberProp(pick([0, -1, 2]))}}`);
      if (chance(0.05)) add("data-n", `data-n={${nullableProp()}}`);
      own(tag, add);
    }
    if (chance(0.25)) add("class", `class=${classValue()}`);
    if (chance(0.2)) add("style", `style=${styleValue()}`);
    if (!svg && chance(0.12)) spread(names, written);
    return written.map((attribute) => ` ${attribute}`).join("");
  }

  /** A prop `make` declares, or a static value. */
  const ownValue = (make: () => string, literal: string) =>
    chance(0.5) ? `{${make()}}` : `"${literal}"`;

  /** The attributes only some HTML elements have, static or bound. */
  function own(tag: string, add: (name: string, source: string) => void): void {
    switch (tag) {
      case "a":
        if (chance(0.7)) {
          add(
            "href",
            `href=${ownValue(() => stringProp(pick(["/a", "#top", "/b?x=1&y=2", "about:blank"])), "/a")}`,
          );
        }
        return;
      case "img":
        add("src", `src=${ownValue(() => stringProp("about:blank"), "data:,")}`);
        add("alt", `alt={${stringProp()}}`);
        if (chance(0.3)) add("width", `width={${numberProp(16)}}`);
        return;
      case "input":
        add("type", `type="${pick(["text", "email", "number", "checkbox"])}"`);
        if (chance(0.4)) add("name", `name={${stringProp("field")}}`);
        if (chance(0.3)) add("placeholder", `placeholder={${stringProp()}}`);
        if (chance(0.3)) add("disabled", `disabled={${booleanProp()}}`);
        if (chance(0.2)) add("required", `required={${booleanProp()}}`);
        if (chance(0.2)) add("readonly", "readonly");
        return;
      case "button":
        add("type", `type="${pick(["button", "submit", "reset"])}"`);
        if (chance(0.3)) add("disabled", `disabled={${booleanProp()}}`);
        return;
      case "ol":
        if (chance(0.4)) add("start", `start={${numberProp(pick([3, -1]))}}`);
        if (chance(0.3)) add("reversed", `reversed={${booleanProp()}}`);
        return;
      case "td":
      case "th":
        if (chance(0.3)) add("colspan", `colspan={${numberProp(pick([1, 2]))}}`);
        return;
      case "select":
        add("name", `name="choice"`);
        if (chance(0.3)) add("disabled", `disabled={${booleanProp()}}`);
        return;
      case "textarea":
        add("name", `name="note"`);
        if (chance(0.3)) add("rows", `rows={${numberProp(pick([2, 3]))}}`);
        if (chance(0.3)) add("placeholder", `placeholder={${stringProp()}}`);
        return;
      case "pre":
      case "section":
      case "div":
        if (chance(0.1)) add("lang", `lang={${stringProp("en")}}`);
        return;
      default:
    }
  }

  /** A static value, or a prop holding it, typed as `type` (an enumerated one's literals). */
  const svgValue = (value: string | number, type?: string) => {
    if (!chance(0.5)) return `"${value}"`;
    if (typeof value === "number") return `{${numberProp(value)}}`;
    return `{${type ? declare("e", type, value) : stringProp(value)}}`;
  };

  /** SVG attributes, static and bound, with SVG's own case. */
  function svgAttributes(tag: string, add: (name: string, source: string) => void): void {
    switch (tag) {
      case "svg":
        add("viewBox", `viewBox=${svgValue("0 0 10 10")}`);
        if (chance(0.5)) add("width", `width=${svgValue(10)}`);
        return;
      case "circle":
        add("cx", `cx=${svgValue(5)}`);
        add("r", `r=${svgValue(pick([1, 2]))}`);
        if (chance(0.5)) add("stroke-width", `stroke-width=${svgValue(1)}`);
        return;
      case "rect":
        add("width", `width=${svgValue(4)}`);
        add("height", `height=${svgValue("2")}`);
        if (chance(0.5)) add("fill", `fill=${svgValue(pick(["red", "none"]))}`);
        return;
      case "path":
        add("d", `d=${svgValue("M0 0 L 5 5")}`);
        if (chance(0.5)) {
          add(
            "stroke-linecap",
            `stroke-linecap=${svgValue("round", '"butt" | "round" | "square"')}`,
          );
        }
        return;
      case "text":
        add("x", `x=${svgValue(0)}`);
        add("y", `y=${svgValue(8)}`);
        return;
      case "linearGradient":
        add("id", `id="${prefix}g"`);
        if (chance(0.5)) {
          const units = '"userSpaceOnUse" | "objectBoundingBox"';
          add("gradientUnits", `gradientUnits=${svgValue("userSpaceOnUse", units)}`);
        }
        return;
      case "stop":
        add("offset", `offset=${svgValue(pick(["0", "1"]))}`);
        add("stop-color", `stop-color=${svgValue("blue")}`);
        return;
      default:
    }
  }

  /** A class name no other part of the component uses. */
  const token = () => `t${seed}x${++tokens}`;

  /** A prop holding a dynamic part's value: names, none, empty, null or undefined. */
  const dynamicProp = () => {
    const value = pick([
      `${token()}`,
      `${token()} ${token()}`,
      ` ${token()}\t`,
      "",
      null,
      undefined,
    ]);
    if (value === null) return declare("c", "string | null", null);
    return declare("c", "string", value, value === undefined ? { absent: chance(0.5) } : {});
  };

  /** A `class` value, in one of its forms, with names that never repeat on the element. */
  function classValue(): string {
    const used = new Set<string>();
    const fresh = (pool: readonly string[]) => {
      const names = pool.filter((name) => !name.split(" ").some((part) => used.has(part)));
      const chosen = pick(names.length ? names : [token()]);
      for (const part of chosen.split(" ")) used.add(part);
      return chosen;
    };
    switch (Math.floor(next() * 5)) {
      case 0:
        return `"${fresh(STATIC_CLASSES)}"`;
      case 1:
        return `{${dynamicProp()}}`;
      case 2: {
        const entries = Array.from({ length: 1 + Math.floor(next() * 3) }, () => {
          const name = fresh(TOGGLE_CLASSES);
          return `${/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)}: ${condition()}`;
        });
        return `{{ ${entries.join(", ")} }}`;
      }
      case 3:
        return `{${condition()} ? "${token()}" : "${token()} ${token()}"}`;
      default: {
        const items = Array.from({ length: 1 + Math.floor(next() * 4) }, () => {
          switch (Math.floor(next() * 5)) {
            case 0:
              return `"${fresh(STATIC_CLASSES)}"`;
            case 1:
              return `${condition()} && "${fresh(TOGGLE_CLASSES)}"`;
            case 2:
              return `{ ${JSON.stringify(fresh(TOGGLE_CLASSES))}: ${condition()} }`;
            case 3:
              return `\`${token()}-\${${stringProp(pick(["a", "b"]))}}\``;
            default:
              return dynamicProp();
          }
        });
        // All static, it would be a static `class` (UF3004).
        if (items.every((item) => item.startsWith('"'))) items.push(dynamicProp());
        return `{[${items.join(", ")}]}`;
      }
    }
  }

  /** A `style` value: a static string, or an object of static and bound declarations. */
  function styleValue(): string {
    const chosen = STYLE_PROPERTIES.filter(() => chance(0.3));
    if (!chosen.length) chosen.push(pick(STYLE_PROPERTIES));
    if (chance(0.25)) {
      return `"${chosen.map(({ property, values }) => `${property}: ${pick(values)}`).join("; ")}"`;
    }
    const entries = chosen.map(({ key, values, numbers }) => {
      const how = Math.floor(next() * 4);
      if (how === 0) return `${key}: ${JSON.stringify(pick(values))}`;
      if (how === 1 && numbers) return `${key}: ${numberProp(pick(numbers))}`;
      if (how === 2) {
        // Left out when nullish or empty.
        const empty = chance(0.5);
        return `${key}: ${declare("v", "string", empty ? "" : undefined, empty ? {} : { absent: chance(0.5) })}`;
      }
      return `${key}: ${stringProp(pick(values))}`;
    });
    return `{{ ${entries.join(", ")} }}`;
  }

  /** A spread of a typed object, its keys none the element writes, maybe optional. */
  function spread(names: Set<string>, written: string[]): void {
    // A spread's `class` merges with the element's own; any other key is the spread's alone.
    const spreadKeys = ["title", "data-x", "aria-label", "class", "lang"].filter(
      (key) => (key === "class" || !names.has(key)) && chance(0.6),
    );
    if (!spreadKeys.length) return;
    const type = `${prefix}Attrs${types.length}`;
    types.push(
      `interface ${type} {\n${spreadKeys.map((key) => `  ${/-/.test(key) ? JSON.stringify(key) : key}?: string;`).join("\n")}\n}`,
    );
    const value: Record<string, unknown> = {};
    for (const key of spreadKeys) {
      if (chance(0.7)) value[key] = key === "class" ? `t${seed}x${++tokens}` : text();
    }
    // An optional source reads every key through `?.`.
    const name = chance(0.3)
      ? chance(0.5)
        ? declare("a", type, value, { optional: true })
        : declare("a", type, undefined, { absent: chance(0.5) })
      : declare("a", type, value);
    for (const key of spreadKeys) names.add(key);
    written.unshift(`{...${name}}`);
  }

  /** A random element of a tag, with attributes and content. */
  function element(tag: string, place: Place): string {
    if (tag === "svg") return svgElement("svg", 0);
    const inner = content(tag, place);
    const open = `<${tag}${attributes(tag, false)}`;
    if (["br", "img", "input"].includes(tag)) return `${open} />`;
    return `${open}>${inner}</${tag}>`;
  }

  /** An SVG subtree: shapes, a gradient, text, a list of shapes, no whitespace text. */
  function svgElement(tag: string, depth: number): string {
    const open = `<${tag}${attributes(tag, true)}`;
    switch (tag) {
      case "svg":
      case "g": {
        const children = Array.from({ length: Math.floor(next() * (depth > 1 ? 2 : 4)) }, () => {
          const kind = pick([
            "circle",
            "rect",
            "path",
            "g",
            "text",
            "linearGradient",
            "list",
            "if",
          ]);
          if (kind === "list") {
            const numbers = declare("l", "number[]", uniqueNumbers());
            return `{${numbers}.map((x) => <rect key={x} x={x} width="1" height="1" />)}`;
          }
          if (kind === "if") return `{${condition()} && <circle cx="1" r="1" />}`;
          return svgElement(kind === "g" && depth > 1 ? "rect" : kind, depth + 1);
        });
        return `${open}>${children.join("")}</${tag}>`;
      }
      case "text":
        return `${open}>${interpolation()}${chance(0.5) ? ` <tspan>${interpolation()}</tspan>` : ""}a</${tag}>`;
      case "linearGradient":
        return `${open}><stop${attributes("stop", true)} /></${tag}>`;
      default:
        return `${open} />`;
    }
  }

  /** Distinct numbers for a list keyed by its values, sometimes none. */
  const uniqueNumbers = () =>
    chance(0.2)
      ? []
      : [
          ...new Set(
            Array.from({ length: 1 + Math.floor(next() * 3) }, () => Math.floor(next() * 9)),
          ),
        ];

  /** A list of objects with unique ids, its item type declared locally. */
  function objectList(): { name: string; type: string } {
    const type = `${prefix}Item${types.length}`;
    types.push(`interface ${type} {\n  id: string;\n  label: string;\n  on: boolean;\n}`);
    const items = chance(0.2)
      ? []
      : Array.from({ length: 1 + Math.floor(next() * 3) }, () => ({
          id: `k${++keys}`,
          label: text(),
          on: chance(0.5),
        }));
    return { name: declare("l", `${type}[]`, items), type };
  }

  /** The body of a list item: text or an interpolation of the item, and maybe a conditional. */
  function itemContent(item: string, index: string | undefined): string {
    const parts = [
      pick([`{${item}.label}`, `${item}: {${item}.label}`, `{${item}.id}`]),
      ...(chance(0.4) ? [`{${item}.on ? <b>on</b> : ${JSON.stringify(text())}}`] : []),
      ...(index && chance(0.6) ? [`{${index}}`] : []),
    ];
    return parts.join(chance(0.5) ? " " : "");
  }

  /** A list: the source, its callback and its keyed body, in a parent that allows it. */
  function list(parent: string, place: Place): string {
    const { name } = objectList();
    const indexed = chance(0.4);
    const index = indexed ? "index" : undefined;
    const key = indexed && chance(0.5) ? "index" : "item.id";
    const source = chance(0.3) ? `${name}.filter((each) => each.label.length > 0)` : name;
    const bodyTag =
      parent === "ul" || parent === "ol"
        ? "li"
        : parent === "tbody"
          ? "tr"
          : parent === "select"
            ? "option"
            : pick(PHRASING_PARENTS.has(parent) ? ["span", "b"] : ["span", "b", "p"]);
    let body: string;
    if (bodyTag === "tr") {
      body = `<tr key={${key}}><td>${itemContent("item", index)}</td></tr>`;
    } else if (bodyTag === "option") {
      body = `<option key={${key}} value={item.id}>{item.label}</option>`;
    } else if (bodyTag === "li" && place.depth < 2 && chance(0.3)) {
      // A nested list, its variables named apart from the outer ones (UF3024).
      const inner = declare(
        "l",
        "string[]",
        ["x", "y"].filter(() => chance(0.7)),
      );
      body = `<li key={${key}}>${itemContent("item", index)}<ul>{${inner}.map((word) => <li key={word}>{word}</li>)}</ul></li>`;
    } else {
      body = `<${bodyTag} key={${key}}${chance(0.3) ? ` class={{ on: item.on }}` : ""}>${itemContent("item", index)}</${bodyTag}>`;
    }
    return `{${source}.map((item${indexed ? ", index" : ""}) => ${body})}`;
  }

  /** A child element of a random allowed tag, one level deeper. */
  const child = (allowed: readonly string[], place: Place) => {
    const tag = pick(allowed);
    return element(tag, {
      depth: place.depth + 1,
      interactive: place.interactive || INTERACTIVE.has(tag),
    });
  };

  /** A conditional with element, text or several nodes in its branches. */
  function conditional(allowed: readonly string[], place: Place): string {
    const branch = (): string => {
      switch (Math.floor(next() * 4)) {
        case 0:
          return JSON.stringify(text());
        case 1:
          return `<>${textChild(text())}${child(allowed, place)}</>`;
        default:
          return child(allowed, place);
      }
    };
    // A conditional whose branches hold no JSX is an interpolation: keep one element in each.
    const chain = (...parts: string[]) => {
      if (!parts.some((part) => part.startsWith("<"))) parts[0] = child(allowed, place);
      return parts;
    };
    switch (Math.floor(next() * 4)) {
      case 0:
        return `{${condition()} && ${branch()}}`;
      case 1: {
        const [a, b] = chain(branch(), chance(0.3) ? "null" : branch());
        return `{${condition()} ? ${a} : ${b}}`;
      }
      case 2: {
        const [a, b, c] = chain(branch(), chance(0.3) ? "null" : branch(), branch());
        return `{${condition()} ? ${b} : ${condition()} ? ${a} : ${c}}`;
      }
      default: {
        const [a, b] = chain(branch(), branch());
        return `{${condition()} ? ${a} : ${condition()} && ${b}}`;
      }
    }
  }

  /** Text, interpolations, conditionals, lists and elements, never two texts in a row. */
  function mixed(allowed: readonly string[], place: Place, max: number, parent: string): string[] {
    const children: string[] = [];
    let lastText = false;
    const count =
      (place.depth === 0 ? 2 : 0) + Math.floor(next() * (place.depth >= 3 ? 2 : max + 1));
    const candidates = allowed.filter((tag) => !(place.interactive && INTERACTIVE.has(tag)));
    for (let index = 0; index < count; index++) {
      const roll = next();
      if (!lastText && roll < 0.3) {
        children.push(textChild(text()));
        lastText = true;
        continue;
      }
      lastText = false;
      if (roll < 0.4) children.push(interpolation());
      else if (roll < 0.5) {
        children.push(interpolation(), textChild(text()));
        lastText = true;
      } else if (roll < 0.62 && place.depth < 3) children.push(conditional(candidates, place));
      else if (roll < 0.7 && place.depth < 3 && !place.interactive)
        children.push(list(parent, place));
      else children.push(child(candidates, place));
    }
    return children;
  }

  /** Between `min` and `max` elements made by `make`. */
  const repeat = (min: number, max: number, make: () => string) =>
    Array.from({ length: min + Math.floor(next() * (max - min + 1)) }, make).join("");

  function content(tag: string, place: Place): string {
    const deeper = { ...place, depth: place.depth + 1 };
    switch (tag) {
      case "div":
      case "section":
      case "li":
      case "td":
      case "th":
        return mixed(
          place.depth >= 3 ? [...INLINES, ...LEAVES] : [...BLOCKS, ...INLINES, ...LEAVES],
          place,
          4,
          tag,
        ).join("");
      case "p":
      case "span":
      case "b":
      case "i":
      case "em":
      case "a":
      case "label":
        return mixed([...INLINES, ...LEAVES], place, 4, tag).join("");
      case "button":
        return mixed(["span", "b", "i", "em"], place, 2, tag).join("");
      case "pre": {
        // Preformatted text keeps every space and line break; it never starts with a line feed.
        const children = mixed(["b", "i", "span", "br"], place, 4, tag);
        return [`a${pick(["  ", "\t", " "])}`.replace(/\t/, '{"\\t"}'), ...children].join("");
      }
      case "ul":
      case "ol":
        return chance(0.5)
          ? list(tag, place)
          : repeat(1, 2, () => element("li", deeper)) +
              (chance(0.3) ? `{${condition()} && ${element("li", deeper)}}` : "");
      case "table":
        return `<tbody>${chance(0.5) ? list("tbody", place) : repeat(1, 2, () => `<tr>${element(pick(["td", "th"]), deeper)}</tr>`)}</tbody>`;
      case "select":
        return chance(0.5)
          ? list("select", place)
          : repeat(1, 3, () => `<option>${textChild(pick(["one", "two", "three"]))}</option>`);
      case "textarea":
        return chance(0.8) ? textChild(text().replace(/^\n+/, "") || "t") : "";
      default:
        return "";
    }
  }

  let jsx: string;
  if (options.root) {
    const children = mixed([...BLOCKS, ...INLINES], { depth: 1, interactive: false }, 5, "#root");
    if (!children.length) children.push(interpolation());
    jsx = `<>${children.join("")}</>`;
  } else {
    jsx = element(pick(FLOW), { depth: 0, interactive: false });
  }
  const parameter = props.map(({ name, defaultCode }) =>
    defaultCode ? `${name} = ${defaultCode}` : name,
  );
  const members = props.map(({ name, type, value, absent, defaultCode, optional }) => {
    const question = optional || absent || value === undefined || defaultCode !== undefined;
    return `${name}${question ? "?" : ""}: ${type};`;
  });
  return {
    name: `seed ${seed}`,
    ...(types.length ? { types: types.join("\n\n") } : {}),
    ...(props.length ? { params: `{ ${parameter.join(", ")} }: { ${members.join(" ")} }` } : {}),
    jsx,
    props: Object.fromEntries(
      props.filter(({ absent }) => !absent).map(({ name, value }) => [name, value]),
    ),
  };
}
