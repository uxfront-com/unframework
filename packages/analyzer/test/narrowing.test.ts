// What the conditions around a value make of it where it is read (src/narrowing.ts): `?.` and
// `??` on a value every target narrows there do nothing (UF3023), and Angular rejects them
// (NG8107, NG8102); where the targets' checkers read it differently (a property narrowed outside
// a closure, a prop in a list's key), or the compiler does not follow the condition, the
// spelling some checker rejects is reported (UF1002). Each case was probed against Angular 22's
// compiler (strict templates) and every target's type check.
import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component, problems } from "./helpers.ts";

const BEFORE = [
  "interface Inner { title: string; other?: string }",
  "interface Box { inner?: Inner; items?: string[]; name?: string }",
  'type Union = { kind: "a"; inner: Inner } | { kind: "b"; inner?: Inner };',
  "type Res = { ok: true; value: Inner } | { ok: false; value?: Inner };",
  "",
].join("\n");
const PROPS =
  "box: Box; items: string[]; maybe?: Inner; on: boolean; rows: Box[]; count?: number; note?: string | null; value?: string | number; u: Union; res: Res; units: Union[]; opt?: (Inner | undefined)[]; label?: string; query?: string; nums: number[]; current: Inner; metas: { meta?: Inner | null }[]";

function check(jsx: string, pattern?: string) {
  const { source, diagnostics, module } = component(`<div>${jsx}</div>`, {
    props: PROPS,
    before: BEFORE,
    ...(pattern ? { pattern } : {}),
  });
  return { source, diagnostics, module, problems: problems(source, diagnostics) };
}

describe("`?.` and `??` on a value a condition narrows on every target (UF3023)", () => {
  it.each([
    // A member: Angular reports the `?.` (NG8107).
    ["{box.inner && <p title={box.inner?.title}>x</p>}", "box.inner.title"],
    ["{box.inner ? <p title={box.inner?.title}>x</p> : null}", "box.inner.title"],
    ["{!box.inner ? <i>n</i> : <p title={box.inner?.title}>x</p>}", "box.inner.title"],
    ['<p title={box.inner ? box.inner?.title : ""}>x</p>', "box.inner.title"],
    ["{on && box.inner && <p title={box.inner?.title}>x</p>}", "box.inner.title"],
    ["{box.inner && on && <p title={box.inner?.title}>x</p>}", "box.inner.title"],
    ["{(box.inner && on) ? <p title={box.inner?.title}>x</p> : null}", "box.inner.title"],
    ["{on ? <i>a</i> : box.inner ? <p title={box.inner?.title}>x</p> : null}", "box.inner.title"],
    ['{box.inner && <p class={["a", box.inner?.title]}>x</p>}', "box.inner.title"],
    [
      "<ul>{rows.map((row, k) => <li key={k}>{row.inner && <b title={row.inner?.title}>x</b>}</li>)}</ul>",
      "row.inner.title",
    ],
    [
      "<p>{rows.filter((row) => row.inner && row.inner?.title).length}</p>",
      "row.inner && row.inner.title",
    ],
    // A prop and an arrow function's parameter: Angular reports the arrow's.
    ["{maybe && <p title={maybe?.title}>x</p>}", "maybe.title"],
    ["<p>{[maybe].filter((m) => m && m?.title).length}</p>", "m && m.title"],
    // `??` (NG8102), on a member and through a narrowed `?.`.
    ['{box.name && <p title={box.name ?? "x"}>x</p>}', "title={box.name}"],
    ['{box.inner && <p title={box.inner?.title ?? "x"}>x</p>}', "title={box.inner.title}"],
    // A list's source.
    ["{box.items && <ul>{box.items?.map((i) => <li key={i}>{i}</li>)}</ul>}", "box.items.map("],
    // Any operand of the `&&`, with an else too, as TypeScript narrows it.
    ["{box.inner && on ? <p title={box.inner?.title}>x</p> : <i>n</i>}", "box.inner.title"],
    // The comparisons TypeScript narrows by, and a member through `?.`.
    ["{box.inner?.title && <p title={box.inner?.other}>x</p>}", "box.inner.other"],
    ["{box.inner !== undefined && <p title={box.inner?.title}>x</p>}", "box.inner.title"],
    ['<p title={box.inner !== undefined ? box.inner?.title : ""}>x</p>', "box.inner.title"],
    ["{box.inner?.title !== undefined && <p title={box.inner?.other}>x</p>}", "box.inner.other"],
    // `!` and `||` as TypeScript reads them.
    ["{!!box.inner && <p title={box.inner?.title}>x</p>}", "box.inner.title"],
    ["{!(box.inner === undefined) && <p title={box.inner?.title}>x</p>}", "box.inner.title"],
    ["{!(box.inner === undefined || on) && <p title={box.inner?.title}>x</p>}", "box.inner.title"],
    // A discriminant of the union the value is a member of.
    ['{u.kind === "a" && <p>{u.inner?.title}</p>}', "u.inner.title"],
    ['{u.kind === "b" ? <p>b</p> : <p>{u.inner?.title}</p>}', "u.inner.title"],
    ["{res.ok && <p>{res.value?.title}</p>}", "res.value.title"],
    [
      '<ul>{units.map((i, k) => <li key={k}>{i.kind === "a" ? i.inner?.title : "b"}</li>)}</ul>',
      "i.inner.title",
    ],
    ['{u.kind === "a" && <p>{(u.inner ?? { title: "x" }).title}</p>}', "(u.inner).title"],
    // A parameter keeps its narrowing in a closure: a list's item, an arrow's parameter, and a
    // destructured prop in a conditional child's branch (Solid's keyed callback receives it).
    ["{maybe && <ul>{items.map((i) => <li key={i}>{maybe?.title}</li>)}</ul>}", "{maybe.title}"],
    ['{maybe && <p>{items.filter((x) => x === maybe?.title).join(",")}</p>}', "x === maybe.title"],
    [
      "{opt && <ul>{opt.map((row, k) => <li key={k}>{row && <b>{items.filter((i) => i === row?.title).length}</b>}</li>)}</ul>}",
      "i === row.title",
    ],
    [
      "<p>{[maybe].filter((m) => m && items.some((i) => i === m?.title)).length}</p>",
      "i === m.title",
    ],
  ])("reports the operator in %s, and the fix writes %s", (jsx, fixed) => {
    const { source, diagnostics } = check(jsx);
    expect(
      codes(diagnostics).every((code) => code === "UF3023"),
      JSON.stringify(diagnostics),
    ).toBe(true);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });

  it("reports the object form's member, and its prop", () => {
    for (const jsx of [
      "{props.box.inner && <p title={props.box.inner?.title}>x</p>}",
      "{props.maybe && <p title={props.maybe?.title}>x</p>}",
    ]) {
      const { source, diagnostics } = check(jsx, "props");
      expect(codes(diagnostics)).toEqual(["UF3023"]);
      expect(applyAndRecheck(source, diagnostics)).not.toContain("?.");
    }
  });

  it("lowers a list over a source a condition narrows", () => {
    const { diagnostics, module } = check(
      "{box.items && <ul>{box.items.map((i) => <li key={i}>{i}</li>)}</ul>}",
    );
    expect(diagnostics).toEqual([]);
    expect(module).toBeDefined();
  });
});

describe("`?.` and `.` where the targets' checkers read a value alike", () => {
  it.each([
    // Read through `.` where every target narrows it.
    "{box.inner && <p title={box.inner.title}>x</p>}",
    "{!box.inner ? <i>n</i> : <p title={box.inner.title}>x</p>}",
    "{on && box.inner ? <p title={box.inner.title}>x</p> : <i>n</i>}",
    "{on ? <i>a</i> : box.inner ? <p title={box.inner.title}>x</p> : null}",
    "{box.inner && <div>{on && <p title={box.inner.title}>x</p>}</div>}",
    "{on && box.inner && on && <p title={box.inner.title}>x</p>}",
    // The read is the value the condition tests.
    "{box.inner?.title && <p title={box.inner.title}>x</p>}",
    // Any operand of an `&&`, with an else or after another branch, as TypeScript narrows it.
    "{box.inner && on ? <p title={box.inner.title}>x</p> : <i>n</i>}",
    "{on ? <i>a</i> : box.inner && on ? <p title={box.inner.title}>x</p> : null}",
    // The comparisons TypeScript narrows by: with `null` or `undefined`, `typeof`, a member
    // through `?.`, `Array.isArray`, and failing where the else reads it.
    "{box.inner?.title && <p title={box.inner.other}>x</p>}",
    "{box.inner !== undefined && <p title={box.inner.title}>x</p>}",
    "{box.inner === undefined ? <i>n</i> : <p title={box.inner.title}>x</p>}",
    "{count !== undefined && count > 0 && <p>{count.toFixed(1)}</p>}",
    "{count != null ? <p>{count.toFixed(1)}</p> : <i>n</i>}",
    "{note != null && <p>{note.trim()}</p>}",
    '{box.inner?.title === "t" && <p title={box.inner.other}>x</p>}',
    '{typeof value === "string" ? <p>{value.trim()}</p> : <i>{value}</i>}',
    "{Array.isArray(box.items) && <p>{box.items.join()}</p>}",
    // An expression's own conditional: every target copies it, and TypeScript narrows it alike.
    '<p title={box.inner !== undefined ? box.inner.title : ""}>x</p>',
    '<p title={box.inner?.title ? box.inner.other : ""}>x</p>',
    // `?.` where Angular does not narrow the value, or does not check it: a property in an
    // arrow function, which every checker forgets, and the props' own template variables.
    "{box.inner && <p>{items.filter((i) => i === box.inner?.title).length}</p>}",
    // `??` on a value no condition tests.
    "{box.inner && <p title={box.name ?? box.inner.title}>x</p>}",
    // `!` and `||` as TypeScript reads them, and an else where nothing narrows the value.
    "{!(box.inner === undefined || on) && <p title={box.inner.title}>x</p>}",
    "{(on || box.inner) && <p title={box.inner?.title}>x</p>}",
    '{box.inner && box.inner.title.length > 3 ? <p>{box.inner.title}</p> : <p>{box.inner?.title ?? "anon"}</p>}',
    // A union a test of something else narrows nothing in.
    "<p>{u.inner?.title}</p>",
    "{on && <p>{u.inner?.title}</p>}",
    // A destructured prop a conditional child narrows, read in a closure in its branch: Solid's
    // keyed callback receives it narrowed, and the other targets read the source's own local.
    "{maybe && <ul>{items.map((i) => <li key={i}>{maybe.title}: {i}</li>)}</ul>}",
    "{maybe ? <ul>{items.map((i) => <li key={i}>{maybe.title}</li>)}</ul> : <p>none</p>}",
    "{!maybe ? <p>none</p> : <ul>{items.map((i) => <li key={i}>{maybe.title}</li>)}</ul>}",
    "{count !== undefined && <ul>{items.map((i) => <li key={i}>{count.toFixed(1)}</li>)}</ul>}",
    "{maybe && on ? <ul>{items.map((i) => <li key={i}>{maybe.title}</li>)}</ul> : <i>n</i>}",
    "{on ? <i>a</i> : maybe ? <ul>{items.map((i) => <li key={i}>{maybe.title}</li>)}</ul> : null}",
    "{maybe && <ul>{rows.map((r, k) => <li key={k}><ol>{items.map((i) => <li key={i}>{maybe.title}</li>)}</ol></li>)}</ul>}",
    '{maybe && <p>{items.filter((x) => x === maybe.title).join(",")}</p>}',
    "{maybe && <p title={items.find((x) => x === maybe.title)}>x</p>}",
    '{typeof value === "string" && <ul>{items.map((i) => <li key={i}>{value.trim()}</li>)}</ul>}',
    // `?.` on a prop an expression's conditional narrows outside an arrow, which Solid copies
    // with `props.maybe`.
    '<p>{maybe ? items.filter((x) => x === maybe?.title).join(",") : "none"}</p>',
    // A list's key: Angular's `track` reads a prop from its input, which its checker never
    // narrows, so `?.` and `??` stay.
    "{maybe && <ul>{items.map((i) => <li key={maybe?.title + i}>x</li>)}</ul>}",
    "<ul>{items.map((i) => <li key={maybe ? maybe?.title + i : i}>x</li>)}</ul>",
    '{label !== undefined && <ul>{items.map((i) => <li key={(label ?? "") + i}>x</li>)}</ul>}',
  ])("accepts %s", (jsx) => {
    expect(check(jsx).diagnostics).toEqual([]);
  });

  it("accepts a prop of the object form tested outside a list, read through `?.` in it", () => {
    const jsx =
      "{props.maybe && <ul>{props.items.map((i) => <li key={i}>{props.maybe?.title}</li>)}</ul>}";
    expect(check(jsx, "props").diagnostics).toEqual([]);
  });
});

// A spelling some target's checker rejects: Angular narrows a member in its loops, which a JSX
// target's callback forgets; a closure forgets a property's narrowing, a prop's on Solid
// (`props.maybe`); Angular's `track` never narrows a prop; and a form the compiler does not
// follow may narrow the value for Angular, which then rejects `?.`.
describe("a value the targets' checkers read differently (UF1002)", () => {
  it.each([
    // Outside a list's callback: TypeScript forgets a property's narrowing in the callback.
    [
      "{box.inner && <ul>{items.map((i) => <li key={i}>{box.inner?.title}</li>)}</ul>}",
      "?.",
      "box.inner",
    ],
    [
      "{box.inner && <ul>{items.map((i) => <li key={i}>{box.inner.title}</li>)}</ul>}",
      "box.inner",
      "box.inner",
    ],
    [
      "<ul>{rows.map((row, k) => <li key={k}>{row.inner && <ol>{items.map((i) => <li key={i}>{row.inner?.title}</li>)}</ol>}</li>)}</ul>",
      "?.",
      "row.inner",
    ],
    [
      "{box.items && <ul>{rows.map((r, k) => <li key={k}>{(box.items ?? []).map((i) => <b key={i}>{i}</b>)}</li>)}</ul>}",
      "??",
      "box.items",
    ],
    [
      "{box.items && <ul>{rows.map((r, k) => <li key={k}>{box.items?.map((i) => <b key={i}>{i}</b>)}</li>)}</ul>}",
      "box.items",
      "box.items",
    ],
    // A form the compiler does not follow: an equality with a value of another type.
    [
      "{box.inner?.title === label && <p title={box.inner?.other}>x</p>}",
      "?.",
      "box.inner?.title === label",
    ],
    // A prop an expression's conditional narrows, read through `.` in an arrow in it: Solid
    // copies the expression with `props.maybe`, which the closure forgets.
    [
      '<p>{maybe ? items.filter((x) => x === maybe.title).join(",") : "none"}</p>',
      "maybe",
      "maybe",
    ],
    // A prop in a list's key, narrowed around the list or in the key.
    ["{maybe && <ul>{items.map((i) => <li key={maybe.title + i}>x</li>)}</ul>}", "maybe", "maybe"],
    ["<ul>{items.map((i) => <li key={maybe ? maybe.title + i : i}>x</li>)}</ul>", "maybe", "maybe"],
  ])("reports %s at %s", (jsx, at, condition) => {
    const { source, diagnostics } = check(jsx);
    expect(codes(diagnostics)).toEqual(["UF1002"]);
    const [diagnostic] = diagnostics;
    expect(source.slice(diagnostic!.span.start, diagnostic!.span.end)).toBe(at);
    expect(diagnostic!.related?.map(({ span }) => source.slice(span.start, span.end))).toEqual([
      condition,
    ]);
  });

  // Angular does not check a prop's own template variable, so `?.` passes it, and every other
  // target: the help says so.
  it("asks for `?.` on a prop a closure forgets the narrowing of, and accepts it", () => {
    const { source, diagnostics } = check(
      '<p>{count !== undefined ? items.map((i) => i + count.toFixed(1)).join() : ""}</p>',
    );
    expect(problems(source, diagnostics)).toEqual(["UF1002 count"]);
    expect(diagnostics[0]!.help).toMatch(/^Read it through `\?\.`/);
    expect(
      check('<p>{count !== undefined ? items.map((i) => i + count?.toFixed(1)).join() : ""}</p>')
        .diagnostics,
    ).toEqual([]);
  });

  it("keeps the rule for the object form, whose `props.maybe` a closure forgets everywhere", () => {
    const jsx =
      "{props.maybe && <ul>{props.items.map((i) => <li key={i}>{props.maybe.title}</li>)}</ul>}";
    const { source, diagnostics } = check(jsx, "props");
    expect(problems(source, diagnostics)).toEqual(["UF1002 props.maybe"]);
  });

  it("leaves a prop a comparison leaves nullable as it is declared: `!== undefined` keeps a `null`", () => {
    // `note` may be `null`: `?.` still reads it, and `.` is the author's type error.
    expect(check("{note !== undefined && <p>{note?.trim()}</p>}").diagnostics).toEqual([]);
    expect(
      codes(check("{note !== null && note !== undefined && <p>{note?.trim()}</p>}").diagnostics),
    ).toEqual(["UF3023"]);
  });
});

// Round three: every use of a narrowed value where some target does not see the narrowing, a
// value a test shows absent, the discriminant of a union across closures, and what a test that
// mentions a value without narrowing it leaves. Probed through every target's toolchain.
describe("uses of a value some target does not see narrowed (UF1002)", () => {
  it.each([
    // An expression's own conditional, used in an arrow function in it: Solid's `props.x`.
    ['<p>{query ? items.filter((item) => item.includes(query)).join(", ") : "All"}</p>', "query"],
    ['<p>{count !== undefined ? nums.map((n) => n * count).join() : ""}</p>', "count"],
    ["<p>{count !== undefined ? nums.filter((n) => n > count).length : 0}</p>", "count"],
    [
      '<p>{typeof value === "string" ? items.filter((i) => i === value.trim()).join() : ""}</p>',
      "value",
    ],
    ['<p>{u.kind === "a" ? items.map((x) => x + u.inner.title).join() : ""}</p>', "u"],
    // A list's key: Angular's `track` reads the prop from its input.
    [
      "{count !== undefined && <ul>{items.map((x, i) => <li key={count + i}>{x}</li>)}</ul>}",
      "count",
    ],
    ["{label && <ul>{nums.map((n) => <li key={label?.length + n}>x</li>)}</ul>}", "label"],
  ])("reports %s at %s", (jsx, at) => {
    const { source, diagnostics } = check(jsx);
    expect(problems(source, diagnostics)).toEqual([`UF1002 ${at}`]);
  });

  it.each([
    // Testing it, `?.`, `??`, an equality and a string read alike everywhere.
    '<p>{query ? items.filter((item) => item.includes(query ?? "")).join(", ") : "All"}</p>',
    "<p title={query && items.find((x) => x === query)}>x</p>",
    '<p>{query ? items.map((item) => item + query).join() : ""}</p>',
    "{count !== undefined && <ul>{items.map((x, i) => <li key={(count ?? 0) + i}>{x}</li>)}</ul>}",
    "{label && <ul>{nums.map((n) => <li key={(label?.length ?? 0) + n}>x</li>)}</ul>}",
    "{count !== undefined && <ul>{items.map((x, i) => <li key={`${count}-${i}`}>{x}</li>)}</ul>}",
    // A discriminant narrows the union reference, which a destructured prop or a list's item
    // keeps in a conditional child's closures.
    '{u.kind === "a" && <ul>{items.map((x) => <li key={x}>{u.inner.title} {x}</li>)}</ul>}',
    '{u.kind === "a" && <p>{items.map((x) => x + u.inner.title).join()}</p>}',
    '<ul>{units.map((i, k) => <li key={k}>{i.kind === "a" && <ol>{items.map((x) => <li key={x}>{i.inner.title}</li>)}</ol>}</li>)}</ul>',
    // A test that mentions the value without narrowing it: `??`, a relational comparison.
    "{(box.inner?.title.length ?? 0) > 1 && <p>{box.inner?.other}</p>}",
    '{items.includes(box.inner?.title ?? "") && <p>{box.inner?.other}</p>}',
  ])("accepts %s", (jsx) => {
    expect(check(jsx).diagnostics).toEqual([]);
  });

  it("reports a member read of a value a test shows absent, across a list too", () => {
    const { source, diagnostics } = check(
      "{!box.inner && <ul>{items.map((i) => <li key={i}>{box.inner?.title ?? i}</li>)}</ul>}",
    );
    expect(problems(source, diagnostics)).toEqual(["UF1002 box.inner"]);
    expect(diagnostics[0]!.message).toContain("shows to be absent");
    // A falsy string is no absent one: `label?.length` reads it where `!label` holds.
    expect(check("{!label && <p>{label?.length}</p>}").diagnostics).toEqual([]);
  });

  it("keeps a test it does not follow beside the nullish kinds a comparison takes out", () => {
    const { codes: found } = {
      codes: codes(
        check(
          "<ul>{metas.map((row, k) => <li key={k}>{row.meta !== null && row.meta === current && <b>{row.meta?.title}</b>}</li>)}</ul>",
        ).diagnostics,
      ),
    };
    expect(found).toEqual(["UF1002"]);
  });
});

// Round four: the tests TypeScript narrows a type by narrow the kinds the checks read (UF3016,
// UF3018), in either branch, where every target keeps them. Probed through every target's
// toolchain (L3, L4, L5).
describe("kinds a test narrows", () => {
  const before = [
    'type Body = { kind: "text"; content: string } | { kind: "list"; content: string[] };',
    'type Pair = { kind: "a"; v: string } | { kind: "b"; v: number };',
    "type Loose = { count: number; label: string } | { count: string; label: number };",
    "",
  ].join("\n");
  const props =
    "body: Body; to: string | string[]; v: number | string[]; size: number | string; pair: Pair; items: string[]; blocks: Body[]; loose: Loose; action: 'submit' | 'reset' | 'go'";
  const run = (jsx: string, pattern?: string) => {
    const { source, diagnostics } = component(`<div>${jsx}</div>`, {
      props,
      before,
      ...(pattern ? { pattern } : {}),
    });
    return problems(source, diagnostics);
  };

  it.each([
    // A discriminant re-reads a member from the shapes that remain.
    '{body.kind === "text" && <p>{body.content}</p>}',
    '{body.kind === "list" && <ul>{body.content.map((line) => <li key={line}>{line}</li>)}</ul>}',
    '{body.kind === "text" ? <p>{body.content}</p> : <ul>{body.content.map((line) => <li key={line}>{line}</li>)}</ul>}',
    '<p title={pair.kind === "a" ? pair.v : undefined}>x</p>',
    '<ul>{blocks.map((b, i) => <li key={i}>{b.kind === "text" ? b.content : b.content.join(", ")}</li>)}</ul>',
    // `typeof` and `Array.isArray`, where they hold and where they fail.
    '<p>{typeof to === "string" ? to : to.join(", ")}</p>',
    '<p>{Array.isArray(to) ? to.join(" · ") : to}</p>',
    '<p>{typeof v === "number" ? v : v.length}</p>',
    '<p style={{ width: typeof size === "number" ? `${size}px` : size }}>x</p>',
    '<img alt="" width={typeof size === "number" ? size : undefined} />',
    '{typeof size === "string" && <p title={size}>x</p>}',
    "{Array.isArray(to) ? <ul>{to.map((t) => <li key={t}>{t}</li>)}</ul> : <p>{to}</p>}",
    // A literal leaves the literals it does not equal.
    '{action !== "go" && <button type={action}>x</button>}',
    // A destructured prop keeps it in a conditional child's closures.
    '{typeof to !== "string" && <ul>{items.map((i) => <li key={i}>{to.join()}{i}</li>)}</ul>}',
  ])("accepts %s", (jsx) => {
    expect(run(jsx)).toEqual([]);
  });

  it("narrows the object form's props too", () => {
    expect(
      run('{typeof props.to === "string" ? <p>{props.to}</p> : <p>{props.to.join()}</p>}', "props"),
    ).toEqual([]);
  });

  it.each([
    // A member TypeScript does not read as a discriminant (no literal type) narrows nothing.
    ["{loose.count === 1 && <p title={loose.label}>x</p>}", "UF3018 loose.label"],
    // Without the test, a literal no target's types list.
    ["<button type={action}>x</button>", "UF3018 action"],
    // Where some target forgets the narrowing, a use that relies on it is reported.
    ['<p>{typeof to !== "string" ? items.map((i) => i + to.join()).join() : ""}</p>', "UF1002 to"],
  ])("reports %s", (jsx, problem) => {
    expect(run(jsx)).toEqual([problem]);
  });

  it("reports a property narrowed outside a list's callback, which TypeScript forgets there", () => {
    expect(
      run(
        '{typeof props.to !== "string" && <ul>{props.items.map((i) => <li key={i}>{props.to.join()}{i}</li>)}</ul>}',
        "props",
      ),
    ).toEqual(["UF1002 props.to"]);
  });
});
