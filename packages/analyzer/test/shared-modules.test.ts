import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

// Shared modules and module-level declarations (ADR-0070): a component reads values and types from
// relative `.ts` modules, as the compiler's resolver read them, and its module's top-level `const`
// declarations, each through a read-only binding of its own.
import type { SharedModule } from "../src/index.ts";
import { moduleSpecifiers, sharedModuleImports, unfollowedImports } from "../src/index.ts";
import { codes, problems, run } from "./helpers.ts";

/** The shared modules a test's resolver read, by specifier. */
function modules(
  entries: Record<string, SharedModule | undefined>,
): ReadonlyMap<string, SharedModule | undefined> {
  return new Map(Object.entries(entries));
}

const TOKENS = modules({ "./tokens": { file: "tokens.ts" } });

describe("module-level constants", () => {
  it("reads a constant in a template and in setup code, through a binding of the component's", () => {
    const source = [
      "const SIZES = { sm: 8, md: 12 } as const;",
      "const UNUSED = 1;",
      "export function A() {",
      "  const gap = SIZES.md * 2;",
      "  return <p data-gap={gap}>{SIZES.sm}</p>;",
      "}",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(module!.constants).toEqual([
      {
        name: "SIZES",
        binding: "SIZES@6",
        value: { code: "{ sm: 8, md: 12 } as const", span: { start: 14, end: 40 }, refs: [] },
        span: { start: 0, end: 41 },
      },
    ]);
    const bindings = module!.components[0]!.bindings.filter((each) => each.kind === "moduleConst");
    expect(bindings).toEqual([
      { id: "SIZES@6", name: "SIZES", kind: "moduleConst", span: { start: 6, end: 11 } },
    ]);
    expect(JSON.stringify(module!.components[0]!.render)).toContain('"binding":"SIZES@6"');
    expect(JSON.stringify(module!.components[0]!.setup)).toContain('"binding":"SIZES@6"');
  });

  it("keeps the constants a read constant reads, its annotation and its globals, in source order", () => {
    const source = [
      "const BASE = 4;",
      "const LABEL: string = String(BASE * 2);",
      "export function A() { return <p>{LABEL}</p>; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(
      module!.constants!.map(({ name, type, value }) => [name, type?.code, value.refs]),
    ).toEqual([
      ["BASE", undefined, []],
      [
        "LABEL",
        "string",
        [
          { kind: "Global", name: "String", span: { start: 38, end: 44 } },
          { kind: "Binding", binding: "BASE@6", span: { start: 45, end: 49 } },
        ],
      ],
    ]);
  });

  it("reads a constant function, called, in a template", () => {
    const source = [
      "const double = (value: number) => value * 2;",
      "export function A({ count }: { count: number }) { return <p>{double(count)}</p>; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(JSON.stringify(module!.components[0]!.render)).toContain(
      '"binding":"double@6","span":{"start":',
    );
    expect(JSON.stringify(module!.components[0]!.render)).toContain('"call":true');
  });

  it("lets a getter call a local function that reads only a constant (UF2014)", () => {
    const source = [
      'import { computed, ref } from "unframework";',
      "const STEP = 2;",
      "export function A() {",
      "  const count = ref(0);",
      "  function step() { return STEP; }",
      "  const next = computed(() => count.value + step());",
      "  return <p>{next.value}</p>;",
      "}",
    ].join("\n");
    expect(run(source).diagnostics).toEqual([]);
  });

  it.each([
    ["a `let`", "let max = 3;\n", "let max = 3;"],
    ["a `const` of two constants", "const a = 1, b = 2;\n", "const a = 1, b = 2;"],
    ["a destructured `const`", "const { max } = { max: 3 };\n", "{ max }"],
    ["an exported `const`", "export const max = 3;\n", "export const max = 3;"],
  ])("reports %s (UF1002)", (_, before, reported) => {
    const source = `${before}export function A() { return <p>Hi</p>; }`;
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual([`UF1002 ${reported}`]);
  });

  it("reports what a constant may not read: a global it cannot, and itself", () => {
    const source = [
      "const STORE = localStorage;",
      "const loop = (n: number): number => (n ? loop(n - 1) : 0);",
      "export function A() { return <p>{String(STORE)}{loop(1)}</p>; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual(["UF3020 localStorage", "UF1002 loop"]);
  });

  // The module computes its constants as it loads, on the server too, and no code changes them:
  // each is checked as setup code is (ADR-0070).
  it.each([
    ["JSX (UF3012)", "const ICON = <svg />;", "{ICON}", "UF3012 <svg />"],
    ["chance (UF3019)", "const SEED = Math.random();", "{SEED}", "UF3019 Math.random"],
    ["the clock (UF3019)", "const NOW = Date.now();", "{NOW}", "UF3019 Date"],
    ["the locale (UF3019)", "const L = (1).toLocaleString();", "{L}", "UF3019 toLocaleString"],
    [
      "the clock through `Intl` (UF3019)",
      "const F = new Intl.NumberFormat();",
      "{String(F)}",
      "UF3019 Intl",
    ],
    ["chance through `crypto` (UF3019)", "const U = crypto.randomUUID();", "{U}", "UF3019 crypto"],
    [
      "the clock through `performance` (UF3019)",
      "const P = performance.now();",
      "{P}",
      "UF3019 performance",
    ],
    [
      "a computed `Math.random` (UF3019)",
      'const R = Math["random"]();',
      "{R}",
      'UF3019 Math["random"]',
    ],
    [
      "a computed locale method (UF3019)",
      "const S = (1)[`toLocaleString`]();",
      "{S}",
      "UF3019 `toLocaleString`",
    ],
    [
      "a computed member of `Math` (UF1002)",
      'const K = "max";\nconst M2 = Math[K](1, 2);',
      "{M2}",
      "UF1002 Math[K]",
    ],
    ["`this` (UF1002)", "const T = this;", "{String(T)}", "UF1002 this"],
    [
      "a function expression, a generator among them (UF1002)",
      "const G = function* () { yield 1; };",
      "{String(G)}",
      "UF1002 function* () { yield 1; }",
    ],
    ["`import.meta` (UF1002)", "const M = import.meta.url;", "{M}", "UF1002 import.meta"],
    [
      "`import()` (UF1002)",
      'const load = () => import("./x");',
      "{String(load)}",
      'UF1002 import("./x")',
    ],
    [
      "a change in place of another constant (UF2004)",
      "const LIST: number[] = [];\nconst add = (n: number) => { LIST.push(n); };",
      "{add(1)}",
      "UF2004 LIST.push(n)",
    ],
    [
      "a write of another constant (UF2011)",
      "const COUNT = 0;\nconst reset = () => { COUNT = 1; };",
      "{reset()}",
      "UF2011 COUNT = 1",
    ],
    [
      "a read of a constant declared after it (UF2023)",
      "const TOTAL = STEP + 1;\nconst STEP = 1;",
      "{TOTAL}",
      "UF2023 STEP",
    ],
    [
      "a call of a function that reads a constant declared after it (UF2023)",
      "const g = () => STEP;\nconst TOTAL = g();\nconst STEP = 1;",
      "{TOTAL}",
      "UF2023 g",
    ],
    [
      "a function called where it is written, reading a later constant (UF2023)",
      "const TOTAL = (() => STEP)();\nconst STEP = 1;",
      "{TOTAL}",
      "UF2023 STEP",
    ],
    [
      "a function it passes on, reading a later constant (UF2023)",
      "const ALL = [1].map((n) => n + STEP);\nconst STEP = 1;",
      "{ALL.length}",
      "UF2023 STEP",
    ],
    [
      "a call, as it loads, of a function that reads the clock (UF3019)",
      "const stamp = () => Date.now();\nconst T0 = stamp();",
      "{T0}",
      "UF3019 stamp",
    ],
  ])("reports a constant whose value holds %s", (_, before, read, problem) => {
    const source = `${before}\nexport function A() { return <p>${read}</p>; }`;
    const { module, diagnostics } = run(source);
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual([problem]);
  });

  it("accepts a function that reads a constant declared after it, and writes its own locals", () => {
    const source = [
      "const total = (items: number[]) => { let sum = 0; for (const item of items) sum += item; const [first = 0] = items; return sum + first + STEP; };",
      "const STEP = 2;",
      "const SIZES = {} as typeof TABLE;",
      "const TABLE = { sm: 1 };",
      "export function A() { return <p>{total([1])}{String(SIZES)}{TABLE.sm}</p>; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(module!.constants!.map(({ name }) => name)).toEqual(["total", "STEP", "SIZES", "TABLE"]);
  });

  // A module's values are plain and read-only (ADR-0070): nothing in a constant changes a value
  // in place, whatever the receiver, and a function writes only its own locals.
  it.each([
    [
      "a write through `as`",
      "const T = { a: 1 } as const;\nconst f = () => { (T as { a: number }).a = 2; };",
      "UF2004 (T as { a: number }).a = 2",
    ],
    [
      "a write through `!`",
      "const T = { a: 1 };\nconst f = () => { T!.a = 2; };",
      "UF2004 T!.a = 2",
    ],
    [
      "a mutating call through `as`",
      "const L: number[] = [];\nconst f = () => { (L as number[]).push(1); };",
      "UF2004 (L as number[]).push(1)",
    ],
    [
      "a computed mutating call",
      'const L = [2, 1];\nconst f = () => { L["sort"](); };',
      'UF2004 L["sort"]()',
    ],
    [
      "a call of a computed member",
      'const L = [2, 1];\nconst K = "sort";\nconst f = () => { L[K](); };',
      "UF1002 L[K]",
    ],
    [
      "an array pattern's target",
      "const T = { n: 0 };\nconst f = () => { [T.n] = [1]; };",
      "UF2004 [T.n] = [1]",
    ],
    [
      "an object pattern's target",
      "const T = { n: 0 };\nconst f = () => { ({ a: T.n } = { a: 1 }); };",
      "UF2004 { a: T.n } = { a: 1 }",
    ],
    [
      "a call through an alias",
      "const L: number[] = [];\nconst f = () => { const b = L; b.push(1); };",
      "UF2004 b.push(1)",
    ],
    [
      "a loop's member target",
      'const T = { n: "" };\nconst f = () => { for (T.n in { a: 1 }) {} };',
      "UF2004 T.n",
    ],
    [
      "`++` on a constant",
      "let i = 0;\nconst f = () => { i++; };",
      "UF1002 let i = 0;\nUF2011 i++",
    ],
    ["`++` on a member", "const T = { n: 0 };\nconst f = () => { T.n++; };", "UF2004 T.n++"],
    [
      "`delete`",
      "const T: { n?: number } = { n: 0 };\nconst f = () => { delete T.n; };",
      "UF2004 delete T.n",
    ],
    [
      "`Object.assign`",
      "const T = { n: 0 };\nconst f = () => { Object.assign(T, { n: 1 }); };",
      "UF2004 Object.assign(T, { n: 1 })",
    ],
    [
      "a `Map`'s `set`",
      'const M = new Map<string, number>();\nconst f = () => { M.set("a", 1); };',
      'UF2004 M.set("a", 1)',
    ],
    [
      "a write of an import",
      'import { sizes } from "./tokens";\nconst f = () => { sizes = {}; };',
      "UF2011 sizes = {}",
    ],
  ])("reports %s in a module's function", (_, before, expected) => {
    const source = `${before}\nexport function A() { return <p>{String(f)}</p>; }`;
    const { diagnostics } = run(source, "Test.uf.tsx", { modules: TOKENS });
    expect(problems(source, diagnostics).filter((each) => !each.startsWith("UF1002 f"))).toEqual(
      expected.split("\n"),
    );
  });

  // A fresh value is one the code builds itself, which no one else holds: it may change, as
  // setup's may (UF2004, ADR-0045). ADR-0070 names frozen objects.
  it.each([
    ["a frozen object", "const SIZES = Object.freeze({ sm: 1, lg: 2 });", "{SIZES.sm}"],
    [
      "a helper that pushes to its own array",
      'const cx = (...parts: string[]) => { const out: string[] = []; for (const p of parts) if (p) out.push(p); return out.join(" "); };',
      '{cx("a", "b")}',
    ],
    [
      "a helper that writes its own object's members",
      "const pick = (keys: string[]) => { const o: Record<string, number> = {}; for (const k of keys) o[k] = 1; return o; };",
      '{Object.keys(pick(["a"])).length}',
    ],
    [
      "a helper that fills its own map",
      "const index = (keys: string[]) => { const m = new Map<string, number>(); keys.forEach((k, i) => m.set(k, i)); return m.size; };",
      '{index(["a"])}',
    ],
    [
      "a `reduce` callback's accumulator",
      "const evens = (xs: number[]) => xs.reduce<number[]>((acc, x) => { if (x % 2 === 0) acc.push(x); return acc; }, []);",
      "{evens([1, 2]).length}",
    ],
    [
      "a sorted copy, as the module loads",
      "const SORTED = [...[3, 1, 2]].sort((a, b) => a - b);",
      "{SORTED[0]}",
    ],
    [
      "a filled new array, as the module loads",
      "const ZEROS = new Array(3).fill(0);",
      "{ZEROS.length}",
    ],
    [
      "an assigned new object, as the module loads",
      "const MERGED = Object.assign({}, { a: 1 });",
      "{MERGED.a}",
    ],
    [
      "a function a value holds, reading a later constant",
      "const formatters = { upper: (v: string) => up(v) };\nconst up = (v: string) => v.toUpperCase();",
      '{formatters.upper("a")}',
    ],
  ])("accepts %s", (_, before, read) => {
    const source = `${before}\nexport function A() { return <p>${read}</p>; }`;
    const { module, diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual([]);
    expect(module).toBeDefined();
  });

  // A parameter holds what its caller gives, and a method named like a copy may return what its
  // receiver holds: neither launders a module's value (UF2004).
  it.each([
    [
      "a parameter it defaults, then fills",
      'const DEFAULTS = ["sm", "md"];\nconst withLarge = (sizes?: string[]) => { if (!sizes) sizes = []; sizes.push("lg"); return sizes; };\nconst X = withLarge(DEFAULTS);',
      "{X.length}",
      'UF2004 sizes.push("lg")',
    ],
    [
      "a parameter it writes, then replaces",
      "const T = { a: 1 };\nconst set = (o: { a: number }) => { o.a = 5; o = { a: 0 }; return o; };\nconst X = set(T);",
      "{X.a}",
      "UF2004 o.a = 5",
    ],
    [
      "a callback's parameter it writes, then replaces",
      "const LIST = [{ done: false }];\nconst X = () => { LIST.forEach((item) => { item.done = true; item = { done: false }; }); };",
      "{String(X)}",
      "UF2004 item.done = true",
    ],
    [
      "a copying method of something that is no array",
      "const TABLE = { a: 1 };\nconst O = { map: () => TABLE };\nconst X = () => { O.map().a = 2; };",
      "{String(X)}",
      "UF2004 O.map().a = 2",
    ],
  ])("reports a change in place through %s (UF2004)", (_, before, read, problem) => {
    const source = `${before}\nexport function A() { return <p>${read}</p>; }`;
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual([problem]);
  });

  it("accepts a copy of an array parameter, or of a module's array, filled afterwards", () => {
    const source = [
      "const LIST = [1, 2];",
      "const more = (xs: readonly number[]) => { const out = xs.map((x) => x * 2); out.push(0); return out; };",
      "export function A() { return <p>{more(LIST).length}</p>; }",
    ].join("\n");
    expect(problems(source, run(source).diagnostics)).toEqual([]);
    const filled = [
      "const LIST = [1, 2];",
      "const fill = () => { const copy = LIST.slice(); copy.push(3); return copy; };",
      "export function A() { return <p>{fill().length}</p>; }",
    ].join("\n");
    expect(problems(filled, run(filled).diagnostics)).toEqual([]);
  });

  // A held arrow runs where a value calls it, through a member, as the module loads (UF2023).
  it.each([
    [
      "a member of a constant",
      "const O = { m: () => STEP };\nconst X = O.m();\nconst STEP = 1;",
      "UF2023 O.m",
    ],
    [
      "an optional call of one",
      "const O = { m: () => STEP };\nconst X = O.m?.();\nconst STEP = 1;",
      "UF2023 O.m",
    ],
    ["a member of a literal", "const X = ({ m: () => STEP }).m();\nconst STEP = 1;", "UF2023 STEP"],
  ])(
    "reports a later constant read through %s as the module loads (UF2023)",
    (_, before, problem) => {
      const source = `${before}\nexport function A() { return <p>{X}</p>; }`;
      expect(problems(source, run(source).diagnostics)).toEqual([problem]);
    },
  );

  // A module's function a template reads, or a value holding one, may be called there: it is
  // judged as a call (UF2014, UF3019), as setup judges a local function (ADR-0045).
  it.each([
    ["passed to `map`", "", "{XS.map(fmt).join()}", "UF2014 fmt"],
    ["held by a value", "const O = { fmt };\n", "{O.fmt(1)}", "UF2014 O"],
    [
      "chosen by a conditional",
      "const other = (n: number) => String(n);\n",
      "{(on ? fmt : other)(1)}",
      "UF2014 fmt",
    ],
    ["called through `call`", "", "{fmt.call(null, 1)}", "UF2014 fmt"],
  ])(
    "reports a client-only module function %s in a template (UF2014)",
    (_, extra, read, problem) => {
      const source = [
        "const XS = [1, 2];",
        "const fmt = (n: number) => document.title + n;",
        `${extra}export function A({ on }: { on: boolean }) { return <p>{String(on)}${read}</p>; }`,
      ].join("\n");
      expect(problems(source, run(source).diagnostics)).toEqual([problem]);
    },
  );

  it("reports a client-only module function passed on as the module loads (UF2014), and the locale passed to `map` in a template (UF3019)", () => {
    const load = [
      "const d = (n: number) => document.title + n;",
      "const T = [1].map(d);",
      "export function A() { return <p>{T.length}</p>; }",
    ].join("\n");
    expect(problems(load, run(load).diagnostics)).toEqual(["UF2014 d"]);
    const locale = [
      "const PRICES = [1200, 99];",
      "const fmt = (n: number) => n.toLocaleString();",
      "export function A() { return <p>{PRICES.map(fmt).join()}</p>; }",
    ].join("\n");
    const { diagnostics } = run(locale);
    expect(problems(locale, diagnostics)).toEqual(["UF3019 fmt"]);
    expect(diagnostics[0]!.message).toContain("a template expression reads it, and may call it");
  });

  it("counts a local type a constant writes as used, and declares it with the constant", () => {
    const source = [
      'type Tone = "info" | "danger";',
      'const LABELS: Record<Tone, string> = { info: "Info", danger: "Danger" };',
      "export function A() { return <p>{LABELS.info}</p>; }",
    ].join("\n");
    const { module, diagnostics } = run(source);
    expect(diagnostics).toEqual([]);
    expect(module!.types.map(({ name }) => name)).toEqual(["Tone"]);
  });

  // A global only client code may read, in a module's function, waits for its call, as a local
  // function's does (UF2014, ADR-0045).
  it("accepts a module function that reads client globals and only client code calls", () => {
    const source = [
      'import { ref } from "unframework";',
      "const log = (m: string) => { console.log(m); };",
      "const later = (f: () => void) => setTimeout(f, 10);",
      "const title = () => document.title;",
      'const saved = () => localStorage.getItem("k");',
      'const load = () => fetch("/x");',
      "const copy = (t: string) => navigator.clipboard.writeText(t);",
      "export function A() {",
      '  const text = ref("");',
      '  function save() { log(title()); later(() => {}); text.value = saved() ?? ""; void load(); void copy(text.value); }',
      '  return <button type="button" onClick={save}>{text.value}</button>;',
      "}",
    ].join("\n");
    expect(problems(source, run(source).diagnostics)).toEqual([]);
  });

  it("reports a module function that reads client globals where render calls it, or the module as it loads (UF2014)", () => {
    const source = [
      "const title = () => document.title;",
      "const indirect = () => title();",
      "const AT_LOAD = indirect();",
      "export function A() {",
      "  function shown() { return indirect(); }",
      "  return <p>{title()}{shown()}{AT_LOAD}</p>;",
      "}",
    ].join("\n");
    const { diagnostics } = run(source);
    expect(problems(source, diagnostics)).toEqual([
      "UF2014 indirect",
      "UF2014 title",
      "UF2014 shown",
    ]);
    expect(diagnostics[1]!.message).toBe(
      "A template expression calls `title`, and it reads `document`, which only client code may: rendering must not read what only client code may, and a framework runs it when it decides to.",
    );
    expect(diagnostics[2]!.message).toContain("it calls `indirect`, which reads `document`");
  });

  // A function's body runs where it is called, as a local function's does (UF3019, ADR-0045).
  it("reports chance, the clock and the locale in a module's function only where render calls it", () => {
    const handler = [
      'import { ref } from "unframework";',
      "const stamp = () => Date.now();",
      "const newId = () => crypto.randomUUID();",
      "export function A() {",
      "  const last = ref(0);",
      '  const id = ref("");',
      "  function save() { last.value = stamp(); id.value = newId(); }",
      '  return <button type="button" onClick={save}>{last.value}{id.value}</button>;',
      "}",
    ].join("\n");
    expect(run(handler).diagnostics).toEqual([]);
    const rendered = [
      "const stamp = () => Date.now();",
      "const later = () => stamp();",
      "const fmt = (n: number) => n.toLocaleString();",
      "export function A() {",
      "  function shown() { return later(); }",
      "  return <p>{fmt(1)}{shown()}</p>;",
      "}",
    ].join("\n");
    const { diagnostics } = run(rendered);
    expect(problems(rendered, diagnostics)).toEqual(["UF3019 fmt", "UF3019 shown"]);
    expect(diagnostics[0]!.message).toBe(
      "`fmt` formats by the machine's locale (`toLocaleString`), and a template expression calls it: the server's render and the browser's would differ.",
    );
    expect(diagnostics[1]!.message).toContain("calls `later`, which reads the clock (`Date`)");
  });

  it("reports a write of a constant (UF2011), and a change in place (UF2004)", () => {
    const source = [
      "const SIZES = { sm: 8 };",
      "const LIST = [1];",
      "export function A() {",
      "  function reset() { SIZES = { sm: 1 }; SIZES.sm = 2; LIST.push(3); }",
      '  return <button type="button" onClick={reset}>{SIZES.sm}</button>;',
      "}",
    ].join("\n");
    const { diagnostics } = run(source);
    expect(codes(diagnostics)).toEqual(["UF2011", "UF2004", "UF2004"]);
    expect(diagnostics[1]!.message).toContain("`SIZES`, a constant the module declares,");
  });
});

describe("imports of shared modules", () => {
  it("lists the specifiers a module imports shared modules by, values or types, each once", () => {
    const parsed = parseModule(
      "A.uf.tsx",
      [
        'import { a } from "./tokens";',
        'import type { T } from "./types.ts";',
        'import { b } from "./tokens";',
        'import F from "./F.uf.tsx";',
        'import { useX } from "./useX.uf.ts";',
        'import "./A.css";',
        'import { c } from "pkg";',
      ].join("\n"),
    );
    expect(sharedModuleImports(parsed)).toEqual(["./tokens", "./types.ts"]);
    const shared = parseModule(
      "tokens.ts",
      [
        'import { a } from "./a.ts";',
        'export { b } from "pkg";',
        'export * from "react";',
        'import R = require("vue");',
        'export const c = () => import("./lazy");',
        "export const d = (name: string) => import(name);",
        "export const e = () => import(`react-dom`);",
        "export const f = () => import(`./${name}.ts`);",
        'export const g = import.meta.glob("./x/*.ts");',
        "export const h = import.meta.env;",
      ].join("\n"),
    );
    expect(moduleSpecifiers(shared)).toEqual([
      "./a.ts",
      "pkg",
      "react",
      "vue",
      "./lazy",
      "react-dom",
    ]);
    // What the compiler cannot follow, as written (UF1202).
    expect(unfollowedImports(shared)).toEqual([
      "import(name)",
      "import(`./${name}.ts`)",
      "import.meta.glob",
    ]);
  });

  it("reads a shared module's values through `import` bindings, and re-imports its types", () => {
    const source = [
      'import { sizes, format as fmt, type Size } from "./tokens";',
      "export function A({ size }: { size: Size }) {",
      "  return <p>{fmt(sizes[size])}</p>;",
      "}",
    ].join("\n");
    const typed = run(source.replace("{ size: Size }", '{ size: "sm" }'), "Test.uf.tsx", {
      modules: TOKENS,
    });
    expect(typed.diagnostics).toEqual([]);
    expect(typed.module!.moduleImports).toEqual([
      {
        specifier: "./tokens",
        file: "tokens.ts",
        names: [
          { imported: "sizes", local: "sizes", span: { start: 9, end: 14 } },
          { imported: "format", local: "fmt", span: { start: 16, end: 29 } },
        ],
        span: { start: 0, end: 59 },
      },
    ]);
    expect(typed.module!.typeImports).toEqual([
      {
        specifier: "./tokens",
        names: [{ imported: "Size", local: "Size", span: { start: 31, end: 40 } }],
        span: { start: 0, end: 59 },
      },
    ]);
    expect(typed.module!.components[0]!.bindings.filter(({ kind }) => kind === "import")).toEqual([
      { id: "sizes@9", name: "sizes", kind: "import", span: { start: 9, end: 14 } },
      { id: "fmt@26", name: "fmt", kind: "import", span: { start: 26, end: 29 } },
    ]);
    const render = JSON.stringify(typed.module!.components[0]!.render);
    expect(render).toContain('{"kind":"Binding","binding":"fmt@26","span":');
    expect(render).toContain('"call":true');
  });

  it("reports a value import the resolver could not read, or without a resolver (UF1202)", () => {
    const source =
      'import { sizes } from "./tokens";\nexport function A() { return <p>{sizes}</p>; }';
    for (const options of [{}, { modules: modules({ "./tokens": undefined }) }]) {
      const { module, diagnostics } = run(source, "Test.uf.tsx", options);
      expect(module).toBeUndefined();
      expect(problems(source, diagnostics)).toEqual(['UF1202 "./tokens"']);
    }
  });

  it("leaves a type import the resolver could not read to the type oracle", () => {
    const source =
      'import type { Size } from "./types";\nexport function A() { return <p>Hi</p>; }';
    const { module, diagnostics } = run(source, "Test.uf.tsx", {
      modules: modules({ "./types": undefined }),
    });
    expect(diagnostics).toEqual([]);
    expect(module!.typeImports![0]!.specifier).toBe("./types");
  });

  it.each([
    [
      "itself",
      { file: "tokens.ts", framework: { specifier: "react", file: "tokens.ts" } },
      '"./tokens" imports "react"',
    ],
    [
      "through another module",
      { file: "tokens.ts", framework: { specifier: "unframework", file: "base.ts" } },
      '"./tokens" reaches "base.ts", which imports "unframework"',
    ],
  ])("reports a shared module that imports a framework %s (UF1204)", (_, shared, message) => {
    for (const specifiers of ["{ sizes }", "type { Size }"]) {
      const source = `import ${specifiers} from "./tokens";\nexport function A() { return <p>Hi</p>; }`;
      const { module, diagnostics } = run(source, "Test.uf.tsx", {
        modules: modules({ "./tokens": shared }),
      });
      expect(module).toBeUndefined();
      expect(problems(source, diagnostics)).toEqual(['UF1204 "./tokens"']);
      expect(diagnostics[0]!.message).toContain(message);
    }
  });

  it("reports a module the shared module reaches that the resolver could not read (UF1202)", () => {
    const source =
      'import { sizes } from "./tokens";\nexport function A() { return <p>{sizes}</p>; }';
    const { module, diagnostics } = run(source, "Test.uf.tsx", {
      modules: modules({
        "./tokens": { file: "tokens.ts", unresolved: { specifier: "./gone", file: "tokens.ts" } },
      }),
    });
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual(['UF1202 "./tokens"']);
    expect(diagnostics[0]!.message).toContain('"./tokens" loads `./gone`');
  });

  it.each([
    ["a namespace import", 'import * as tokens from "./tokens";\n', "* as tokens"],
    ["a side-effect import", 'import "./tokens";\n', 'import "./tokens";'],
  ])("reports %s of a shared module (UF1002)", (_, imports, reported) => {
    const source = `${imports}export function A() { return <p>Hi</p>; }`;
    const { module, diagnostics } = run(source, "Test.uf.tsx", { modules: TOKENS });
    expect(module).toBeUndefined();
    expect(problems(source, diagnostics)).toEqual([`UF1002 ${reported}`]);
  });

  // A key lives in the `.uf.tsx` module that provides it (ADR-0054): a shared module's is none.
  it("reports a value of a shared module passed to `provide` as its key (UF2032)", () => {
    const source = [
      'import { provide } from "unframework";',
      'import { ThemeKey } from "./keys";',
      "export function A() {",
      '  provide(ThemeKey, "dark");',
      "  return <p>Hi</p>;",
      "}",
    ].join("\n");
    const { diagnostics } = run(source, "Test.uf.tsx", {
      modules: modules({ "./keys": { file: "keys.ts" } }),
    });
    expect(problems(source, diagnostics)).toEqual(["UF2032 ThemeKey"]);
  });

  it("reports a write of an import (UF2011)", () => {
    const source = [
      'import { sizes } from "./tokens";',
      "export function A() {",
      "  function reset() { sizes = {}; }",
      '  return <button type="button" onClick={reset}>Reset</button>;',
      "}",
    ].join("\n");
    const { diagnostics } = run(source, "Test.uf.tsx", { modules: TOKENS });
    expect(problems(source, diagnostics)).toEqual(["UF2011 sizes"]);
  });

  it("reports a value of another module read as a value (UF1002)", () => {
    const source = [
      'import Field from "./Field.uf.tsx";',
      "export function A() { return <p>{String(Field)}</p>; }",
    ].join("\n");
    const { diagnostics } = run(source, "Test.uf.tsx", { modules: TOKENS });
    expect(problems(source, diagnostics)).toEqual(['UF1202 "./Field.uf.tsx"', "UF1002 Field"]);
    expect(diagnostics[1]!.message).toContain("reads the values of shared `.ts` modules");
  });
});
