import { reservedParameterName } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { applyAndRecheck, codes, component, only, problems, root } from "./helpers.ts";

/** Props most tests read. */
const PROPS =
  "label: string; count: number; maybe?: string; items: string[]; user: { name: string }";

/** The diagnostics of `{expression}` as a child, with the text under each. */
function check(expression: string, props = PROPS) {
  const { source, diagnostics, module } = component(`<p>{${expression}}</p>`, { props });
  return { source, diagnostics, module, problems: problems(source, diagnostics) };
}

/** The references of the expression a component renders as its only child. */
function refsOf(expression: string, props = PROPS) {
  const { source, module, diagnostics } = component(`<p>{${expression}}</p>`, { props });
  expect(diagnostics).toEqual([]);
  const [child] = root(module).children;
  if (child?.kind !== "Interpolation") throw new Error("Expected an interpolation.");
  return child.value.refs.map((ref) =>
    ref.kind === "Global"
      ? `global ${ref.name}`
      : ref.kind === "Slot"
        ? `slot ${ref.slot}`
        : `${ref.binding.split("@")[0]} ${source.slice(ref.span.start, ref.span.end)}${ref.shorthand ? " shorthand" : ""}`,
  );
}

describe("references", () => {
  it("resolves props, globals and expression-local parameters", () => {
    expect(refsOf("label.toUpperCase() + String(count) + Math.max(count, 1)")).toEqual([
      "label label",
      "global String",
      "count count",
      "global Math",
      "count count",
    ]);
    expect(refsOf('items.filter((item) => item !== label).join(", ")')).toEqual([
      "items items",
      "label label",
    ]);
  });

  it("marks a shorthand property, which a rewrite must expand", () => {
    expect(refsOf("JSON.stringify({ label, n: count })")).toEqual([
      "global JSON",
      "label label shorthand",
      "count count",
    ]);
  });

  it("keeps the code exactly as written, and the IR's span on it", () => {
    const { source, module } = check("label /* why */ .trim()");
    const [child] = root(module).children;
    expect(child?.kind === "Interpolation" && child.value.code).toBe("label /* why */ .trim()");
    expect(
      child?.kind === "Interpolation" && source.slice(child.value.span.start, child.value.span.end),
    ).toBe("label /* why */ .trim()");
  });

  it.each(["window", "arguments", "A", "lable", "Item"])(
    "reports %s as unresolved (UF3020)",
    (name) => {
      const { problems: found, diagnostics } = check(name);
      expect(found).toEqual([`UF3020 ${name}`]);
      expect(diagnostics[0]!.message).toBe(
        `\`${name}\` is not a prop, a setup binding, a list's item or index, or a global a template expression can read.`,
      );
    },
  );

  it("suggests a prop one edit away", () => {
    expect(check("lable").diagnostics[0]!.help).toBe("Did you mean `label`?");
    expect(check("cuont").diagnostics[0]!.help).toBe("Did you mean `count`?");
  });

  it.each([
    ["Date.now()", "Date"],
    ["new Intl.NumberFormat().format(count)", "Intl"],
    ["crypto.randomUUID()", "crypto"],
    ["performance.now()", "performance"],
    ["globalThis.label", "globalThis"],
    ["Math.random()", "Math.random"],
    ['Math["random"]()', 'Math["random"]'],
    ["Math?.random()", "Math?.random"],
    ["count.toLocaleString()", "toLocaleString"],
    ['label.localeCompare("a")', "localeCompare"],
    ["label.toLocaleUpperCase()", "toLocaleUpperCase"],
  ])("reports %s as nondeterministic (UF3019), never also unresolved", (expression, at) => {
    // `new` is UF1002 too, and `Math?.` does nothing (UF3023).
    const found = check(expression).problems.filter(
      (problem) => !problem.startsWith("UF1002") && !problem.startsWith("UF3023"),
    );
    expect(found).toEqual([`UF3019 ${at}`]);
  });

  it("reads the setup's constants, and reports the authoring API used as a value (UF2005)", () => {
    const { source, diagnostics } = component("<p>{double}{ref}</p>", {
      before: 'import { ref } from "unframework";\n',
      setup: "const double = 2; ",
    });
    expect(problems(source, diagnostics)).toEqual(["UF2005 ref"]);
  });

  it("reports module-level declarations and imports of other modules as landing in M5", () => {
    const { source, diagnostics } = component("<p>{max}</p>", { before: "const max = 3;\n" });
    expect(problems(source, diagnostics)).toEqual(["UF1002 const max = 3;", "UF1002 max"]);
    expect(diagnostics[1]!.message).toContain("module-level declarations land in M5");
  });
});

describe("the accepted syntax", () => {
  it.each([
    '"a" + `b${label}c` + label.length',
    "count * 2 - 1 / 3 % 4 ** 2",
    "-count + +count",
    "!label ? 1 : 2",
    "typeof label",
    "label === 'x' ? 'a' : label != 'y' ? 'b' : 'c'",
    "maybe ?? label",
    "maybe?.trim()",
    "items[0] ?? label",
    "items.map((item) => item.trim()).join()",
    "[label, ...items].join()",
    'JSON.stringify({ a: 1, "b-c": label, ...user })',
    "/x/g.test(label) ? 'y' : 'n'",
    "1e21 + 1_000 + .5",
    "user.name",
    "(label)",
  ])("accepts %s", (expression) => {
    expect(check(expression).diagnostics).toEqual([]);
  });

  it.each([
    ["count & 1", "count & 1", "Bitwise operators"],
    ["count | 1", "count | 1", "Angular reads `|` as a pipe"],
    ["~count", "~count", "Bitwise operators"],
    ['"a" in user', '"a" in user', "`in`"],
    ["user instanceof Object", "user instanceof Object", "`instanceof`"],
    ["new Array(3).length", "new Array(3)", "`new`"],
    ["String.raw`x`", "String.raw`x`", "Tagged templates"],
    ["(label as string).length", "label as string", "`as`"],
    ["maybe!.length", "maybe!", "the non-null assertion"],
    ["(label satisfies string).length", "label satisfies string", "`satisfies`"],
    ["String<number>(count)", "<number>", "Type arguments on a call"],
    ["1n", "1n", "BigInt literals"],
    ["[1, , 2].length", "[1, , 2]", "Arrays with holes"],
    ["Array(3).length", "Array", "`Array(…)`"],
    ['JSON.stringify({ ["k"]: 1 })', '"k"', "Computed keys in object literals"],
    ["JSON.stringify({ m() { return 1; } })", "m() { return 1; }", "Methods, getters and setters"],
    ["items.map((item: string) => item).join()", "item: string", "plain names"],
    ["items.map(({ length }) => length).join()", "{ length }", "plain names"],
    ["items.map((item = 'x') => item).join()", "item = 'x'", "plain names"],
    ["items.map((...all) => all).join()", "...all", "plain names"],
    ["items.map(async (item) => item).join()", "async (item) => item", "Async arrow functions"],
  ])("reports %s as not supported yet (UF1002)", (expression, at, message) => {
    const { problems: found, diagnostics } = check(expression);
    expect(found).toContain(`UF1002 ${at}`);
    expect(diagnostics.find((item) => item.code === "UF1002")!.message).toContain(message);
  });

  // Angular's expression lexer reads ASCII identifiers only.
  it.each([
    ["user.café", "café"],
    ["items.filter((é) => é).join()", "é"],
    ["\\u0075ser.name", "\\u0075ser"],
  ])("reports the identifier in %s that is not written in ASCII", (expression, at) => {
    expect(check(expression).problems).toContain(`UF1002 ${at}`);
  });

  it.each([
    ["0x10", "16"],
    ["0b101", "5"],
    ["0o17", "15"],
    ["0XFF", "255"],
  ])("rewrites %s to %s, which Angular reads", (number, decimal) => {
    const { source, diagnostics } = check(`count + ${number}`);
    expect(problems(source, diagnostics)).toEqual([`UF1002 ${number}`]);
    expect(applyAndRecheck(source, diagnostics)).toContain(`count + ${decimal}`);
  });

  it.each([
    ['"\\u{41}"', "\\u{41}", "\\u0041"],
    ['"a\\u{1F600}b"', "\\u{1F600}", "\\uD83D\\uDE00"],
    ["`x${label}\\u{1F600}`", "\\u{1F600}", "\\uD83D\\uDE00"],
  ])("rewrites the escape in %s to four-digit escapes", (literal, at, replacement) => {
    const { source, diagnostics } = check(`${literal} + label`);
    expect(problems(source, diagnostics)).toEqual([`UF1002 ${at}`]);
    expect(applyAndRecheck(source, diagnostics)).toContain(replacement);
  });

  it("rewrites a block-bodied arrow that only returns, and checks what it returns", () => {
    const { source, diagnostics } = check(
      "items.filter((item) => { return item !== lable; }).join()",
    );
    expect(codes(diagnostics)).toEqual(["UF1002", "UF3020"]);
    const fixed = applyAndRecheck(source, diagnostics);
    expect(fixed).toContain("items.filter((item) => item !== lable)");
  });

  it("wraps a returned object literal in parentheses", () => {
    const { source, diagnostics } = check(
      "JSON.stringify(items.map((item) => { return { item }; }))",
    );
    expect(applyAndRecheck(source, diagnostics)).toContain("(item) => ({ item })");
  });

  it("offers no rewrite for a block that does more than return", () => {
    const { diagnostics } = check("items.filter((item) => { const a = item; return a; }).join()");
    expect(diagnostics[0]!.fixes).toBeUndefined();
  });
});

describe("impure expressions (UF3021)", () => {
  it.each([
    ["count = 1", "count = 1"],
    ["count++", "count++"],
    ["delete user.name", "delete user.name"],
    ["void count", "void count"],
    ["(count, label)", "count, label"],
    ["this.label", "this"],
    ["import.meta.url", "import.meta"],
    ["(function () { return 1; })()", "function () { return 1; }"],
    ["(class {}).name", "class {}"],
    ["(() => 1)()", "() => 1"],
    ["Object.assign(user, { name: label }).name", "assign"],
    ["Object.freeze(items).length", "freeze"],
    ["items.push(label)", "push"],
    ["items.fill(label).length", "fill"],
  ])("reports %s", (expression, at) => {
    expect(check(expression).problems).toContain(`UF3021 ${at}`);
  });

  it.each([
    ["items.sort().join()", "items.toSorted().join()"],
    ["items.reverse().join()", "items.toReversed().join()"],
    ["items.splice(1).join()", "items.toSpliced(1).join()"],
    ['items["sort"]().join()', 'items["toSorted"]().join()'],
    ["label.split(',').sort().join()", "label.split(',').toSorted().join()"],
  ])("rewrites %s to the copying method", (expression, fixed) => {
    const { source, diagnostics } = check(expression);
    expect(codes(diagnostics)).toEqual(["UF3021"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(fixed);
  });
});

describe("nullish operators (UF3023)", () => {
  it.each([
    ['label ?? "x"', "label"],
    ["((label)) ?? (count)", "((label))"],
    ["user?.name", "user.name"],
    ["items?.[0]", "items[0]"],
    ["label.trim?.()", "label.trim()"],
    ['user.name ?? "x"', "user.name"],
  ])("rewrites %s, whose left side is never nullish, to %s", (expression, fixed) => {
    const { source, diagnostics } = check(expression);
    expect(codes(diagnostics)).toEqual(["UF3023"]);
    expect(applyAndRecheck(source, diagnostics)).toContain(`<p>{${fixed}}</p>`);
  });

  it.each(['maybe ?? "x"', "maybe?.trim()", "items[0] ?? label", "items[0]?.trim()"])(
    "accepts %s, whose left side can be nullish",
    (expression) => {
      expect(check(expression).diagnostics).toEqual([]);
    },
  );

  it("offers no fix that would remove a reported right side", () => {
    const { source, diagnostics } = check("label ?? lable");
    expect(codes(diagnostics)).toEqual(["UF3023", "UF3020"]);
    expect(diagnostics[0]!.fixes).toBeUndefined();
    applyAndRecheck(source, diagnostics);
  });

  it("reads the kinds as the fix leaves them", () => {
    // Never nullish, `label ?? 1` is `label`: a string, which renders as text.
    expect(codes(check("label ?? true").diagnostics)).toEqual(["UF3023"]);
  });
});

describe("parameters (UF3024)", () => {
  it.each([
    ["items.filter((label) => label).join()", "label", "the prop `label`"],
    ["items.filter((String) => String).join()", "String", "the global `String`"],
    ["items.filter((props) => props).join()", "props", "`props`, which some outputs declare"],
    [
      "items.filter((rawProps) => rawProps).join()",
      "rawProps",
      "`rawProps`, which some outputs declare",
    ],
  ])("reports %s as shadowing", (expression, at, what) => {
    const { problems: found, diagnostics } = check(expression);
    expect(found).toEqual([`UF3024 ${at}`]);
    expect(diagnostics[0]!.message).toContain(`shadows ${what}`);
  });

  it("reports a loop variable shadowed by an arrow inside its list", () => {
    const { source, diagnostics } = component(
      "<ul>{items.map((item) => <li key={item}>{items.filter((item) => item).length}</li>)}</ul>",
      { props: PROPS },
    );
    expect(problems(source, diagnostics)).toEqual(["UF3024 item"]);
  });

  it.each([
    ["items.filter((item, index) => item).join()", "(item, index) => item", "(item) => item"],
    ["items.filter((item, index) => true).join()", "(item, index) => true", "() => true"],
    ["items.filter(item => true).join()", "item => true", "() => true"],
    ["items.filter((item, index) => index > 0).join()", undefined, undefined],
  ])("removes the unread trailing parameters of %s", (expression, from, to) => {
    const { source, diagnostics } = check(expression);
    if (from === undefined) {
      expect(diagnostics).toEqual([]);
      return;
    }
    expect(new Set(codes(diagnostics))).toEqual(new Set(["UF3024"]));
    expect(diagnostics[0]!.message).toContain("is never read");
    const fixed = applyAndRecheck(source, diagnostics);
    expect(fixed).toContain(to);
  });

  // The walk reports these parts without reading them, so it cannot tell that nothing reads a
  // parameter there: a removal would leave the part reading a name nothing declares.
  it.each([
    ["items.map((item) => <b>{item}</b>).length", "UF3012"],
    ["items.filter((item) => item++).length", "UF3021"],
    ["items.filter((item) => String.raw`${item}`).length", "UF1002"],
    ["items.filter((item) => function () { return item; }).length", "UF3021"],
    ["items.filter((item) => ({ get x() { return item; } })).length", "UF1002"],
    ["items.filter((item) => items.some((other = item) => other)).length", "UF1002"],
    ["items.filter((item, index) => { if (index) return item; }).length", "UF1002"],
    // A tag names what it reads, which scope analysis resolves.
    ["items.filter((Tag) => <Tag />).length", "UF3012"],
    ["items.filter((item) => <item.Tag />).length", "UF3012"],
  ])("reads a parameter in %s as read", (expression, code) => {
    const { diagnostics } = check(expression);
    expect(codes(diagnostics)).toContain(code);
    expect(codes(diagnostics)).not.toContain("UF3024");
  });

  it("removes a parameter that a part the walk reports does not read", () => {
    const { source, diagnostics } = check("items.filter((item, index) => item++).length");
    expect(problems(source, diagnostics)).toEqual(["UF3024 index", "UF3021 item++"]);
    expect(applyAndRecheck(source, diagnostics)).toContain("items.filter((item) => item++)");
  });

  it("removes an unread parameter rather than report its shadowing too", () => {
    const { source, diagnostics } = check("items.filter((item, label) => item).join()");
    expect(problems(source, diagnostics)).toEqual(["UF3024 label"]);
    expect(diagnostics[0]!.message).toContain("is never read");
    applyAndRecheck(source, diagnostics);
  });
});

describe("value kinds", () => {
  it.each([
    ["label", true],
    ["count", true],
    ["maybe", true],
    ["count > 1", false],
    ["!label", false],
    ["items", false],
    ["user", false],
    ["label.length", true],
    ["items.length", true],
    ['items.join(", ")', true],
    ["items[0]", true],
    ["user.name", true],
    ["count.toFixed(2)", true],
    ["String(count > 1)", true],
    ["label || count", true],
    ["label && count", true],
    ["count && label", true],
    ["maybe ?? count", true],
    ["count > 1 ? label : count", true],
    ["count > 1 ? label : false", false],
    ["items.includes(label)", false],
    ["items.map((item) => item)", false],
    ["Math.max(count, 2)", true],
    ["JSON.parse(label)", true],
  ])("reads %s as text: %s", (expression, text) => {
    const found = check(expression).diagnostics.filter((item) => item.code === "UF3016");
    expect(found.length).toBe(text ? 0 : 1);
  });

  it("types an arrow's parameters from the array a method reads", () => {
    // `item` is a string: `item.length` is a number, and `?.` on it does nothing.
    expect(codes(check("items.find((item) => item?.length)").diagnostics)).toEqual(["UF3023"]);
  });
});

describe("JSX in expressions (UF3012)", () => {
  it.each([
    ["String(<b />)", "<b />"],
    ["[<b />].length", "<b />"],
  ])("reports %s", (expression, at) => {
    expect(check(expression).problems).toEqual([`UF3012 ${at}`]);
  });

  it("reports JSX in an attribute's value, and in a setup variable", () => {
    const value = component("<p title={<b />}>a</p>");
    expect(problems(value.source, value.diagnostics)).toEqual(["UF3012 <b />"]);
    const setup = component("<p>a</p>", { setup: "const icon = <i />; " });
    expect(problems(setup.source, setup.diagnostics)).toEqual(["UF3012 <i />"]);
  });
});

describe("lint and type-check directives", () => {
  it.each([
    "/* eslint-disable */",
    "// eslint-disable-next-line no-undef\n",
    "/* oxlint-disable-line */",
    "// @ts-ignore\n",
    "/* @ts-expect-error */",
    "/* global foo */",
  ])("reports %j in an expression, with a fix that removes it", (comment) => {
    const { source, diagnostics } = check(`label ${comment} + 1`);
    expect(codes(diagnostics)).toEqual(["UF1002"]);
    expect(applyAndRecheck(source, diagnostics)).not.toContain(comment.trim());
  });

  it("accepts other comments", () => {
    expect(check("label /* the name */ + 1").diagnostics).toEqual([]);
  });
});

describe("bindings", () => {
  it("lists the props and the loop variables by their spans", () => {
    const { source, module } = component(
      "<ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>",
      { props: "items: string[]" },
    );
    expect(only(module).bindings.map((binding) => [binding.id, binding.kind])).toEqual([
      [`items@${source.indexOf("items }")}`, "prop"],
      [`item@${source.indexOf("item,")}`, "loopVar"],
      [`index@${source.indexOf("index)")}`, "loopVar"],
    ]);
  });
});

describe("names Vue's compiled code declares", () => {
  it.each([
    ["<ul>{items.map((__props) => <li key={__props}>a</li>)}</ul>", "__props"],
    [
      "<ul>{items.map((_ssrInterpolate) => <li key={_ssrInterpolate}>a</li>)}</ul>",
      "_ssrInterpolate",
    ],
    ["<p>{items.filter((_ctx) => _ctx).join()}</p>", "_ctx"],
  ])("reports the parameter in %s (UF3024)", (jsx, at) => {
    const { source, diagnostics } = component(jsx, { props: PROPS });
    expect(problems(source, diagnostics)).toEqual([`UF3024 ${at}`]);
    expect(diagnostics[0]!.message).toContain("Vue's compiled render functions declare");
  });

  it("leaves a bare `_` free", () => {
    const { diagnostics } = component("<ul>{items.map((_) => <li key={_}>{_}</li>)}</ul>", {
      props: PROPS,
    });
    expect(diagnostics).toEqual([]);
  });
});

describe("the Fragment Astro's output imports", () => {
  it.each([
    ["<ul>{items.map((Fragment) => <li key={Fragment}>a</li>)}</ul>", "Fragment"],
    ["<p>{items.filter((Fragment) => Fragment).join()}</p>", "Fragment"],
  ])("reports the parameter in %s (UF3024)", (jsx, at) => {
    const { source, diagnostics } = component(jsx, { props: PROPS });
    expect(problems(source, diagnostics)).toEqual([`UF3024 ${at}`]);
    expect(diagnostics[0]!.message).toContain("Astro's output renders `<>` with");
  });
});

// Angular's expression lexer reads its keywords anywhere: `@for (as of items; …)` and
// `(as) => as` do not parse. The others are reserved words, or `undefined`, a global.
describe("Angular's expression keywords", () => {
  it.each([
    ["<ul>{items.map((as) => <li key={as}>{as}</li>)}</ul>", "as"],
    ["<p>{items.filter((as) => as).length}</p>", "as"],
  ])("reports the parameter in %s (UF3024)", (jsx, at) => {
    const { source, diagnostics } = component(jsx, { props: PROPS });
    expect(problems(source, diagnostics)).toEqual([`UF3024 ${at}`]);
    expect(diagnostics[0]!.message).toContain("is a keyword in Angular's template expressions");
  });
});

// The names `checkInvariants` keeps loop variables from (`reservedParameterName`) are the names
// the analyser reports, whatever the component declares.
describe("the names no parameter takes", () => {
  it.each([
    "String",
    "undefined",
    "props",
    "rawProps",
    "Fragment",
    "$index",
    "$x",
    "_ctx",
    "__props",
    "as",
    "_",
    "item",
    "on",
    "x$",
  ])("reports %s as the IR reserves it", (name) => {
    const { diagnostics } = component(
      `<ul>{items.map((${name}) => <li key={${name}}>a</li>)}</ul>`,
      {
        props: PROPS,
      },
    );
    expect(codes(diagnostics)).toEqual(reservedParameterName(name) ? ["UF3024"] : []);
  });
});

describe("names Angular's @for declares", () => {
  it.each([
    ["<p>{items.filter(($index) => $index).join()}</p>", "$index"],
    ["<ul>{items.map(($item) => <li key={$item}>a</li>)}</ul>", "$item"],
  ])("reports the parameter in %s (UF3024)", (jsx, at) => {
    const { source, diagnostics } = component(jsx, { props: PROPS });
    expect(problems(source, diagnostics)).toEqual([`UF3024 ${at}`]);
  });
});

// Angular writes some characters of a regular expression as escapes, which match the same text
// but show in its `source` and string form.
describe("the text of a regular expression Angular respells", () => {
  it.each([
    "<p>{/a;b/.source}</p>",
    '<p>{String(/"x"/)}</p>',
    "<p>{`${/a  b/}`}</p>",
    '<p>{/[(]/ + ""}</p>',
    "<p>{/x{{/.toString()}</p>",
  ])("reports %s (UF1002)", (jsx) => {
    const { diagnostics } = component(jsx, { props: PROPS });
    expect(codes(diagnostics)).toEqual(["UF1002"]);
    expect(diagnostics[0]!.message).toContain("Angular's template writes those characters");
  });

  it.each([
    "<p>{/ab/.source}</p>",
    '<p>{/a;b/.test(label) ? "y" : "n"}</p>',
    '<p>{label.replace(/[;"]/g, "-")}</p>',
    "<p>{label.split(/; /).length}</p>",
  ])("accepts %s", (jsx) => {
    expect(component(jsx, { props: PROPS }).diagnostics).toEqual([]);
  });
});
