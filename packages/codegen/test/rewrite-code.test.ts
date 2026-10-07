// The rewrite engine on setup code (ADR-0045): writes and emits replaced whole once the references
// in their values and arguments are, nested writes, `nextTick`, event members, call flags, sites,
// and the parentheses a replacement needs where it stands.
import {
  createBinding,
  createBindingReference,
  createComponent,
  createConstItem,
  createElement,
  createFunctionCode,
  createFunctionItem,
  span,
} from "@unframework/ir";
import type {
  Binding,
  BindingReference,
  Code,
  SetupItem,
  UfComponent,
  WriteReference,
} from "@unframework/ir";
import { describe, expect, it } from "vitest";

import {
  codeKind,
  codeNames,
  parseStatementsSource,
  rewriteCode,
  rewriteExpression,
  writtenValue,
} from "../src/index.ts";
import type { RewriteRules, RewriteSite, WriteParts } from "../src/index.ts";
import { codeAt, expressionAt } from "./expressions.ts";
import type { CodeTarget } from "./expressions.ts";

// Code sits at offset 1000 of an imaginary source, so a rewrite that forgets the code's own
// offset splices in the wrong place.
const BASE = 1000;

const label = createBinding("label", "prop", span(10, 15));
const count = createBinding("count", "state", span(20, 25));
const doubled = createBinding("doubled", "derived", span(30, 37));
const timer = createBinding("timer", "localVar", span(40, 45));
const step = createBinding("step", "localConst", span(50, 54));
const save = createBinding("save", "localFn", span(60, 64));
const emit = createBinding("emit", "emit", span(70, 74));
const input = createBinding("input", "templateRef", span(80, 85));
const bindings: Binding[] = [label, count, doubled, timer, step, save, emit, input];

let offset = BASE;
/** Setup code at a fresh offset: see {@link codeAt}. */
const code = (text: string, ...targets: CodeTarget[]): Code => {
  const found = codeAt(offset, text, ...targets);
  offset += text.length + 10;
  return found;
};

/** A component whose setup holds each piece of code as a `const`'s value: an expression. */
function component(...pieces: Code[]): UfComponent {
  const setup = pieces.map((piece, index): SetupItem =>
    createConstItem(bindings[index % bindings.length]!.id, piece, piece.span),
  );
  return createComponent(
    "Counter",
    createElement("p", [], [], span(0, 1)),
    span(0, 5000),
    [],
    undefined,
    [],
    bindings,
    setup,
  );
}

/** A function whose block body is `piece`, in a component of its own. */
function inBlock(piece: Code): UfComponent {
  return createComponent(
    "Counter",
    createElement("p", [], [], span(0, 1)),
    span(0, 5000),
    [],
    undefined,
    [],
    bindings,
    [
      createFunctionItem(
        save.id,
        "declaration",
        createFunctionCode([], piece, piece.span),
        piece.span,
      ),
    ],
  );
}

/** Svelte's spelling: a ref's value is its variable, `nextTick` is `tick`, events are props. */
const svelte: RewriteRules = {
  binding: (_, binding, written) =>
    binding.kind === "state" || binding.kind === "derived" || binding.kind === "templateRef"
      ? binding.name
      : written,
  api: () => "tick",
  emit: (emitted, _, parts) => `on${emitted.event}?.(${parts.arguments.join(", ")})`,
};

/** React's spelling: state through its setter, a setup `let` through a ref's `current`. */
const react: RewriteRules = {
  binding: (_, binding, written) =>
    binding.kind === "localVar"
      ? `${binding.name}Ref.current`
      : binding.kind === "state" || binding.kind === "derived"
        ? binding.name
        : binding.kind === "prop"
          ? written
          : written,
  write: (write, binding, parts) =>
    binding.kind === "state"
      ? `set${binding.name[0]!.toUpperCase()}${binding.name.slice(1)}(${writtenValue(write, parts)})`
      : undefined,
};

describe("rewriteCode: writes", () => {
  it("keeps a write as written with its target respelled, without a write rule", () => {
    const written = code(
      "{ count.value += step; count.value++; timer = setTimeout(save, 10); }",
      {
        write: "count.value += step",
        binding: count,
        operator: "+=",
        target: "count.value",
        value: "step",
      },
      ["step", step],
      { write: "count.value++", binding: count, operator: "++", target: "count.value" },
      {
        write: "timer = setTimeout(save, 10)",
        binding: timer,
        operator: "=",
        target: "timer",
        value: "setTimeout(save, 10)",
      },
      ["setTimeout", "Global"],
      ["save", save],
    );
    expect(rewriteCode(written, inBlock(written), svelte, "client")).toBe(
      "{ count += step; count++; timer = setTimeout(save, 10); }",
    );
  });

  // Each operator the IR accepts, through React's setter.
  it.each([
    ["count.value = step", "=", "setCount(step)"],
    ["count.value += step", "+=", "setCount(count + step)"],
    ["count.value -= step", "-=", "setCount(count - step)"],
    ["count.value *= step", "*=", "setCount(count * step)"],
    ["count.value /= step", "/=", "setCount(count / step)"],
    ["count.value %= step", "%=", "setCount(count % step)"],
    ["count.value **= step", "**=", "setCount(count ** step)"],
    ["count.value &&= step", "&&=", "setCount(count && step)"],
    ["count.value ||= step", "||=", "setCount(count || step)"],
    ["count.value ??= step", "??=", "setCount(count ?? step)"],
    ["count.value++", "++", "setCount(count + 1)"],
    ["count.value--", "--", "setCount(count - 1)"],
  ])("replaces `%s` through the write rule", (text, operator, expected) => {
    const value = operator === "++" || operator === "--" ? undefined : "step";
    const written = code(
      `{ ${text}; }`,
      { write: text, binding: count, operator, target: "count.value", ...(value ? { value } : {}) },
      ...(value ? [["step", step] as CodeTarget] : []),
    );
    expect(rewriteCode(written, inBlock(written), react, "client")).toBe(`{ ${expected}; }`);
  });

  it("reads a write's narrowed target as a narrowed read, which a target may assert (ADR-0046)", () => {
    const written = code(
      "{ count.value += step; }",
      {
        write: "count.value += step",
        binding: count,
        operator: "+=",
        target: "count.value",
        value: "step",
      },
      ["step", step],
    );
    const [write, ...rest] = written.refs as [WriteReference, ...Code["refs"]];
    const narrowed: Code = {
      ...written,
      refs: [{ ...write, narrowed: [{ span: write.target, scope: "local" }] }, ...rest],
    };
    const asserting: RewriteRules = {
      ...react,
      binding: (reference, binding, text, site) =>
        `${react.binding(reference, binding, text, site)}${reference.narrowed ? "!" : ""}`,
    };
    expect(rewriteCode(narrowed, inBlock(narrowed), asserting, "client")).toBe(
      "{ setCount(count! + step); }",
    );
    expect(rewriteCode(written, inBlock(written), asserting, "client")).toBe(
      "{ setCount(count + step); }",
    );
  });

  it("gives the rule the target as read, the value rewritten and the write as written", () => {
    const seen: [string, WriteParts][] = [];
    const recorder: RewriteRules = {
      binding: (_, binding) => `${binding.name}()`,
      write: (write, _, parts) => {
        seen.push([write.operator, parts]);
        return undefined;
      },
    };
    const written = code(
      "{ count.value = label.length + doubled.value; count.value++; }",
      {
        write: "count.value = label.length + doubled.value",
        binding: count,
        operator: "=",
        target: "count.value",
        value: "label.length + doubled.value",
      },
      ["label", label],
      ["doubled.value", doubled],
      { write: "count.value++", binding: count, operator: "++", target: "count.value" },
    );
    expect(rewriteCode(written, inBlock(written), recorder, "client")).toBe(
      "{ count() = label().length + doubled(); count()++; }",
    );
    expect(seen).toEqual([
      [
        "=",
        {
          target: "count()",
          value: "label().length + doubled()",
          code: "count() = label().length + doubled()",
        },
      ],
      ["++", { target: "count()", code: "count()++" }],
    ]);
  });

  it("rewrites a write nested in another's value first", () => {
    const written = code(
      "{ timer = setInterval(() => count.value++, 1000); }",
      {
        write: "timer = setInterval(() => count.value++, 1000)",
        binding: timer,
        operator: "=",
        target: "timer",
        value: "setInterval(() => count.value++, 1000)",
      },
      ["setInterval", "Global"],
      {
        write: "count.value++",
        binding: count,
        operator: "++",
        target: "count.value",
        arrowBody: true,
      },
    );
    expect(rewriteCode(written, inBlock(written), react, "client")).toBe(
      "{ timerRef.current = setInterval(() => setCount(count + 1), 1000); }",
    );
  });

  it("replaces an arrow body's write with its parentheses", () => {
    const body = code(
      "(count.value = !count.value)",
      {
        write: "(count.value = !count.value)",
        binding: count,
        operator: "=",
        target: "count.value",
        value: "!count.value",
        arrowBody: true,
      },
      ["count.value", count],
    );
    expect(rewriteCode(body, component(body), react, "client")).toBe("setCount(!count)");
    expect(rewriteCode(body, component(body), svelte, "client")).toBe("(count = !count)");
  });

  it("parenthesises a value a call's argument cannot take as it is", () => {
    // oxc spans a parenthesised sequence without its parentheses.
    const written = code(
      "{ count.value = (step, 2); }",
      {
        write: "count.value = (step, 2)",
        binding: count,
        operator: "=",
        target: "count.value",
        value: "step, 2",
      },
      ["step", step],
    );
    expect(rewriteCode(written, inBlock(written), react, "client")).toBe(
      "{ setCount((step, 2)); }",
    );
  });

  it("parenthesises a replacement that would not stand as a statement or an arrow's body", () => {
    const write = (replacement: string): RewriteRules => ({
      binding: (_, __, written) => written,
      write: () => replacement,
    });
    const statement = () => {
      const written = code("{ count.value = 1; }", {
        write: "count.value = 1",
        binding: count,
        operator: "=",
        target: "count.value",
        value: "1",
      });
      return [written, inBlock(written)] as const;
    };
    for (const [replacement, expected] of [
      ["{ ...state, count: 1 }", "({ ...state, count: 1 })"],
      ["function () {}", "(function () {})"],
      ["(a, b)", "(a, b)"],
      ["a, b", "(a, b)"],
      ["set(1)", "set(1)"],
    ]) {
      const [written, owner] = statement();
      expect(rewriteCode(written, owner, write(replacement!), "client")).toBe(`{ ${expected}; }`);
    }
    const [written, owner] = statement();
    expect(() => rewriteCode(written, owner, write("a; b"), "client")).toThrow(
      "The write rule returned `a; b`, which is not an expression.",
    );
  });

  it("rejects a reference inside a write but outside its value, or a value outside it", () => {
    const inTarget = code("{ count.value = 1; }", {
      write: "count.value = 1",
      binding: count,
      operator: "=",
      target: "count.value",
    });
    inTarget.refs.push(
      createBindingReference(count.id, (inTarget.refs[0] as WriteReference).target),
    );
    expect(() => rewriteCode(inTarget, inBlock(inTarget), svelte, "client")).toThrow(
      "outside its value and its arguments",
    );
    const outside = code("{ count.value = 1; step; }", {
      write: "count.value = 1",
      binding: count,
      operator: "=",
      target: "count.value",
      value: "1",
    });
    (outside.refs[0] as WriteReference).value = span(
      outside.span.start + 20,
      outside.span.start + 24,
    );
    expect(() => rewriteCode(outside, inBlock(outside), svelte, "client")).toThrow(
      "has a value or an argument outside it",
    );
  });
});

describe("writtenValue", () => {
  const parts = (operator: string, target: string, value?: string) =>
    writtenValue({ operator } as WriteReference, {
      target,
      ...(value === undefined ? {} : { value }),
      code: "",
    });

  it.each([
    ["*=", "count", "a + b", "count * (a + b)"],
    ["-=", "count", "a - b", "count - (a - b)"],
    ["+=", "count", "a * b", "count + a * b"],
    ["+=", "count", "c ? 1 : 2", "count + (c ? 1 : 2)"],
    ["+=", "count", "x as number", "count + (x as number)"],
    ["+=", "count", "-x", "count + -x"],
    ["+=", "count", "(a, b)", "count + (a, b)"],
    ["**=", "count", "a ** b", "count ** a ** b"],
    ["**=", "count", "a * b", "count ** (a * b)"],
    ["??=", "count", "a || b", "count ?? (a || b)"],
    ["??=", "count", "a ?? b", "count ?? (a ?? b)"],
    ["||=", "count", "a ?? b", "count || (a ?? b)"],
    ["&&=", "count", "a || b", "count && (a || b)"],
    ["+=", "this.count()", "1", "this.count() + 1"],
    ["+=", "a ?? b", "1", "(a ?? b) + 1"],
    ["**=", "-a", "2", "(-a) ** 2"],
  ])("`%s` on %s with %s is %s", (operator, target, value, expected) => {
    expect(parts(operator, target, value)).toBe(expected);
  });

  it("counts `++` and `--` by one", () => {
    expect(parts("++", "count")).toBe("count + 1");
    expect(parts("--", "count()")).toBe("count() - 1");
  });

  it("rejects an assignment without a value", () => {
    expect(() => parts("+=", "count")).toThrow("has no value");
  });
});

describe("rewriteCode: emits, APIs, event members and calls", () => {
  it.each<[string, CodeTarget[], string, string]>([
    [
      'emit("reset")',
      [{ emit: 'emit("reset")', binding: emit, event: "reset" }],
      "onreset?.()",
      'emit("reset")',
    ],
    [
      'emit("change", count.value)',
      [
        {
          emit: 'emit("change", count.value)',
          binding: emit,
          event: "change",
          arguments: ["count.value"],
        },
        ["count.value", count],
      ],
      "onchange?.(count)",
      'emit("change", count)',
    ],
    [
      'emit("change", count.value, label)',
      [
        {
          emit: 'emit("change", count.value, label)',
          binding: emit,
          event: "change",
          arguments: ["count.value", "label"],
        },
        ["count.value", count],
        ["label", label],
      ],
      "onchange?.(count, label)",
      'emit("change", count, label)',
    ],
  ])("emits %s with the emit rule, or as written", (text, targets, hooked, written) => {
    const statement = code(`{ ${text}; }`, ...targets);
    const owner = inBlock(statement);
    expect(rewriteCode(statement, owner, svelte, "client")).toBe(`{ ${hooked}; }`);
    const noEmit: RewriteRules = { binding: (...spelling) => svelte.binding(...spelling) };
    expect(rewriteCode(statement, owner, noEmit, "client")).toBe(`{ ${written}; }`);
  });

  it("parenthesises an argument a call cannot take as it is", () => {
    const statement = code(
      '{ emit("change", (step, 1)); }',
      { emit: 'emit("change", (step, 1))', binding: emit, event: "change", arguments: ["step, 1"] },
      ["step", step],
    );
    expect(rewriteCode(statement, inBlock(statement), svelte, "client")).toBe(
      "{ onchange?.((step, 1)); }",
    );
  });

  it("rewrites an emit inside a callback, after the code before it", () => {
    const statement = code(
      '{ setTimeout(() => emit("change", count.value + step), 10); }',
      ["setTimeout", "Global"],
      {
        emit: 'emit("change", count.value + step)',
        binding: emit,
        event: "change",
        arguments: ["count.value + step"],
      },
      ["count.value", count],
      ["step", step],
    );
    expect(rewriteCode(statement, inBlock(statement), svelte, "client")).toBe(
      "{ setTimeout(() => onchange?.(count + step), 10); }",
    );
  });

  it("spells `nextTick` and an event's members by their rules, or as written", () => {
    const statement = code(
      "{ event.preventDefault(); await nextTick(); event.currentTarget.focus(); }",
      { member: "preventDefault", text: "event.preventDefault", call: true },
      { api: "nextTick" },
      { member: "currentTarget", text: "event.currentTarget" },
    );
    const qwik: RewriteRules = {
      binding: (_, __, written) => written,
      event: (reference) =>
        reference.member === "currentTarget" ? "element" : "event.preventDefault",
    };
    const owner = inBlock(statement);
    expect(rewriteCode(statement, owner, qwik, "client")).toBe(
      "{ event.preventDefault(); await nextTick(); element.focus(); }",
    );
    expect(rewriteCode(statement, owner, svelte, "client")).toBe(
      "{ event.preventDefault(); await tick(); event.currentTarget.focus(); }",
    );
  });

  it("tells the binding rule a local function is called", () => {
    const statement = code("{ save(); const later = save; }", { call: "save", binding: save }, [
      "save",
      save,
    ]);
    const qwik: RewriteRules = {
      binding: (reference, _, written) => (reference.call ? `await ${written}` : written),
    };
    expect(rewriteCode(statement, inBlock(statement), qwik, "client")).toBe(
      "{ await save(); const later = save; }",
    );
  });

  it("passes the site to every rule", () => {
    const sites: string[] = [];
    const record = <T>(kind: string, site: RewriteSite, result: T): T => {
      sites.push(`${kind}:${site}`);
      return result;
    };
    const rules: RewriteRules = {
      binding: (_, __, written, site) => record("binding", site, written),
      global: (reference, site) => record("global", site, reference.name),
      api: (_, site) => record("api", site, "nextTick"),
      event: (reference, site) => record("event", site, `event.${reference.member}`),
      write: (_, __, ___, site) => record("write", site, undefined),
      emit: (_, __, ___, site) => record("emit", site, undefined),
    };
    const value = code("Math.max(label, 1)", ["Math", "Global"], ["label", label]);
    rewriteCode(value, component(value), rules, "pure");
    const body = code(
      '{ count.value++; emit("reset"); await nextTick(); event.key; }',
      { write: "count.value++", binding: count, operator: "++", target: "count.value" },
      { emit: 'emit("reset")', binding: emit, event: "reset" },
      { api: "nextTick" },
      { member: "key", text: "event.key" },
    );
    rewriteCode(body, inBlock(body), rules, "client");
    const key = expressionAt(BASE, "label", ["label", label]);
    rewriteExpression(key, component(), rules);
    rewriteExpression(key, component(), rules, "key");
    expect(sites).toEqual([
      "global:pure",
      "binding:pure",
      "binding:client",
      "write:client",
      "emit:client",
      "api:client",
      "event:client",
      "binding:render",
      "binding:key",
    ]);
  });
});

describe("rewriteCode: shorthand properties and kinds of code", () => {
  const solid: RewriteRules = {
    binding: (_, binding, written) => (binding.kind === "prop" ? `props.${binding.name}` : written),
    global: (reference) => `globalThis.${reference.name}`,
  };

  it("expands a shorthand property in statements and in an expression", () => {
    const block = code("{ log({ label }); return { NaN }; }", ["label", label], ["NaN", "Global"]);
    expect(rewriteCode(block, inBlock(block), solid, "client")).toBe(
      "{ log({ label: props.label }); return { NaN: globalThis.NaN }; }",
    );
    const value = code("{ label, NaN }", ["label", label], ["NaN", "Global"]);
    expect(rewriteCode(value, component(value), solid, "pure")).toBe(
      "{ label: props.label, NaN: globalThis.NaN }",
    );
  });

  it("tells a block body from an expression by where the code is", () => {
    const block = code("{ label }", ["label", label]);
    // As statements, `{ label }` is a block reading `label`, which the analyser marks no shorthand.
    delete (block.refs[0] as BindingReference).shorthand;
    const value = code("{ label }", ["label", label]);
    const owner = createComponent(
      "Counter",
      createElement("p", [], [], span(0, 1)),
      span(0, 5000),
      [],
      undefined,
      [],
      bindings,
      [
        createFunctionItem(
          save.id,
          "declaration",
          createFunctionCode([], block, block.span),
          block.span,
        ),
        createConstItem(step.id, value, value.span),
      ],
    );
    expect(codeKind(block, owner)).toBe("statements");
    expect(codeKind(value, owner)).toBe("expression");
    expect(rewriteCode(block, owner, solid, "client")).toBe("{ props.label }");
    expect(rewriteCode(value, owner, solid, "pure")).toBe("{ label: props.label }");
  });

  it("returns the code itself when nothing is respelled", () => {
    const value = code("count.value * 2 /* twice */", ["count.value", count]);
    expect(
      rewriteCode(value, component(value), { binding: (_, __, written) => written }, "pure"),
    ).toBe("count.value * 2 /* twice */");
  });
});

describe("parseStatementsSource", () => {
  it("parses statements with offsets relative to their code, `await` and `return` allowed", () => {
    const parsed = parseStatementsSource("await a(); // done\nreturn b /* c */;");
    expect(parsed.statements.map(({ type, start, end }) => [type, start, end])).toEqual([
      ["ExpressionStatement", 0, 10],
      ["ReturnStatement", 19, 36],
    ]);
    expect(parsed.comments.map(({ type, start, end }) => [type, start, end])).toEqual([
      ["Line", 11, 18],
      ["Block", 28, 35],
    ]);
    expect(parseStatementsSource("{ a }").statements.map(({ type }) => type)).toEqual([
      "BlockStatement",
    ]);
    expect(parseStatementsSource("").statements).toEqual([]);
  });

  it.each([
    ["} function f() {", "closes the wrapper's brace"],
    ["a +", "incomplete"],
    ["let a; let a;", "declares a name twice"],
  ])("rejects %j (%s)", (text) => {
    expect(() => parseStatementsSource(text)).toThrow("Cannot parse");
  });
});

describe("codeNames", () => {
  it("collects what statements declare and read, not member, key or label names", () => {
    expect(
      [
        ...codeNames(
          "const { a: b, c } = d; e.f(g); const h = (i: J<K.L>) => i; let m: [n: N] = [o];",
          "statements",
        ),
      ].toSorted(),
    ).toEqual(["J", "K", "N", "b", "c", "d", "e", "g", "h", "i", "m", "o"]);
  });
});
