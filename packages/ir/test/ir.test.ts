import { describe, expect, it } from "vitest";

import {
  checkInvariants,
  childrenOf,
  codeOf,
  collectFeatures,
  createApiReference,
  createBindingReference,
  createBranch,
  createCode,
  createComponent,
  createConstItem,
  createDerivedItem,
  createElement,
  createEmitReference,
  createEmits,
  createEventAttribute,
  createEventControl,
  createEventDeclaration,
  createEventParameter,
  createEventReference,
  createExport,
  createFor,
  createFunctionCode,
  createFunctionHandler,
  createFunctionItem,
  createGetterSource,
  createIdItem,
  createInlineHandler,
  createLifecycleItem,
  createModule,
  createParameter,
  createParameterPattern,
  createProp,
  createPropsParameter,
  createRefAttribute,
  createRefSource,
  createStateItem,
  createStaticAttribute,
  createTemplateRefItem,
  createText,
  createTypeText,
  createVariableItem,
  createWatchEffectItem,
  createWatchItem,
  createWriteReference,
  expressionsOf,
  functionsOf,
  impurity,
  IR_VERSION,
  spansOf,
  span,
  summarize,
  summarizeCode,
  summarizeTracked,
  walk,
} from "../src/index.ts";
import type { UfComponent, VisitedNode } from "../src/index.ts";
import { counterIds, everyKind, expression, ids } from "./fixtures.ts";

const at = span(0, 1);

function sample() {
  const render = createElement(
    "p",
    [createStaticAttribute("class", "greeting", at), createStaticAttribute("hidden", true, at)],
    [createText("Hello", at), createElement("br", [], [], at), createText("world", at)],
    at,
  );
  return createModule(
    "Hello.uf.tsx",
    [createComponent("Hello", render, at)],
    [createExport("default", "Hello", at)],
  );
}

describe("builders", () => {
  it("builds plain, JSON-round-trippable data", () => {
    for (const module of [sample(), everyKind()]) {
      expect(module.irVersion).toBe(IR_VERSION);
      expect(JSON.parse(JSON.stringify(module))).toEqual(module);
    }
  });

  it("builds a module whose IR keeps the invariants", () => {
    expect(checkInvariants(sample())).toEqual([]);
    expect(checkInvariants(everyKind())).toEqual([]);
  });

  it("names the default export 'default' and a named export by its local name", () => {
    expect(createExport("default", "Hello", at)).toMatchObject({ name: "default", local: "Hello" });
    expect(createExport("named", "Hello", at)).toMatchObject({ name: "Hello", local: "Hello" });
  });

  // Snapshots keep the key order of the types, and a JSON round trip drops an `undefined` key
  // that validateModule and a structured clone would keep (r-ir-analyzer).
  it("writes keys in the order of the types and leaves absent optional fields out", () => {
    const type = createTypeText("string", at);
    expect(Object.keys(createProp("label", false, type, at))).toEqual([
      "name",
      "optional",
      "type",
      "span",
    ]);
    expect(Object.keys(createProp("tone", true, type, at, ids.tone, expression('"a"', 0)))).toEqual(
      ["name", "optional", "type", "default", "binding", "span"],
    );
    expect(Object.keys(createPropsParameter("destructured", type, at))).toEqual([
      "form",
      "type",
      "span",
    ]);
    expect(Object.keys(createPropsParameter("object", type, at, "props"))).toEqual([
      "form",
      "name",
      "type",
      "span",
    ]);
    expect(Object.keys(createBranch(undefined, [], at))).toEqual(["children", "span"]);
    expect(Object.keys(createBranch(expression("a", 0), [], at))).toEqual([
      "condition",
      "children",
      "span",
    ]);
    const body = createElement("li", [], [], at);
    expect(
      Object.keys(createFor(expression("a", 0), ids.item, expression("a", 0), body, at)),
    ).toEqual(["kind", "source", "item", "key", "body", "span"]);
    expect(
      Object.keys(createFor(expression("a", 0), ids.item, expression("a", 0), body, at, ids.index)),
    ).toEqual(["kind", "source", "item", "index", "key", "body", "span"]);
    expect(Object.keys(createBindingReference(ids.label, at))).toEqual(["kind", "binding", "span"]);
    expect(createBindingReference(ids.label, at, true)).toEqual({
      kind: "Binding",
      binding: ids.label,
      span: at,
      shorthand: true,
    });
    const component = createComponent("A", body, at);
    expect(Object.keys(component)).toEqual([
      "name",
      "span",
      "props",
      "types",
      "bindings",
      "setup",
      "render",
    ]);
    expect(component.setup).toEqual([]);
    expect(Object.keys(everyKind().components[0]!)).toEqual([
      "name",
      "span",
      "props",
      "propsParameter",
      "types",
      "bindings",
      "setup",
      "render",
    ]);
    expect(Object.keys(everyKind().components[1]!)).toEqual([
      "name",
      "span",
      "props",
      "propsParameter",
      "types",
      "emits",
      "bindings",
      "setup",
      "render",
    ]);
    expect(Object.keys(everyKind())).toEqual([
      "irVersion",
      "file",
      "components",
      "exports",
      "types",
    ]);
  });

  // The M2 builders, each with its optional fields absent and present (ADR-0045).
  it("writes the setup's keys in the order of the types", () => {
    const type = createTypeText("number", at);
    const code = createCode("x", at);
    const fn = createFunctionCode([], code, at);
    const keys = (value: object) => Object.keys(value);
    expect(keys(createBindingReference(ids.label, at, false, true))).toEqual([
      "kind",
      "binding",
      "span",
      "call",
    ]);
    expect(keys(createBindingReference(ids.label, at, true, true))).toEqual([
      "kind",
      "binding",
      "span",
      "shorthand",
      "call",
    ]);
    expect(keys(code)).toEqual(["code", "span", "refs"]);
    expect(keys(createWriteReference("a@1", "++", at, at))).toEqual([
      "kind",
      "binding",
      "operator",
      "span",
      "target",
    ]);
    expect(keys(createWriteReference("a@1", "=", at, at, at, true))).toEqual([
      "kind",
      "binding",
      "operator",
      "span",
      "target",
      "value",
      "arrowBody",
    ]);
    expect(keys(createEmitReference("emit@1", "change", at))).toEqual([
      "kind",
      "binding",
      "event",
      "span",
      "arguments",
    ]);
    expect(keys(createApiReference("nextTick", at))).toEqual(["kind", "api", "span"]);
    expect(keys(createEventReference("key", at))).toEqual(["kind", "member", "span"]);
    expect(keys(createEventReference("preventDefault", at, true))).toEqual([
      "kind",
      "member",
      "span",
      "call",
    ]);
    expect(keys(createEventControl("preventDefault", at))).toEqual(["method", "span"]);
    expect(keys(createEventControl("stopPropagation", at, code))).toEqual([
      "method",
      "condition",
      "span",
    ]);
    expect(keys(fn)).toEqual(["parameters", "body", "span"]);
    expect(
      keys(
        createFunctionCode([], code, at, {
          async: true,
          returnType: type,
          expression: true,
          eventControls: [createEventControl("preventDefault", at)],
        }),
      ),
    ).toEqual(["async", "parameters", "returnType", "body", "expression", "eventControls", "span"]);
    expect(createFunctionCode([], code, at, { eventControls: [] })).toEqual(fn);
    expect(keys(createParameter("a", at))).toEqual(["name", "span"]);
    expect(
      keys(
        createParameter(createParameterPattern("[a]", ["a"], at), at, {
          type,
          optional: true,
          rest: true,
          default: expression("1", 0),
          event: "Event",
        }),
      ),
    ).toEqual(["pattern", "type", "optional", "rest", "default", "event", "span"]);
    expect(keys(createParameterPattern("[a]", ["a"], at))).toEqual(["code", "names", "span"]);
    expect(keys(createStateItem("a@1", at))).toEqual(["kind", "binding", "span"]);
    expect(keys(createStateItem("a@1", at, code, type))).toEqual([
      "kind",
      "binding",
      "type",
      "initial",
      "span",
    ]);
    expect(keys(createDerivedItem("a@1", fn, at, type))).toEqual([
      "kind",
      "binding",
      "type",
      "getter",
      "span",
    ]);
    expect(keys(createTemplateRefItem("a@1", at, type))).toEqual([
      "kind",
      "binding",
      "type",
      "span",
    ]);
    expect(keys(createIdItem("a@1", at))).toEqual(["kind", "binding", "span"]);
    expect(keys(createConstItem("a@1", code, at, type))).toEqual([
      "kind",
      "binding",
      "type",
      "value",
      "span",
    ]);
    expect(keys(createVariableItem("a@1", at, code, type))).toEqual([
      "kind",
      "binding",
      "type",
      "initial",
      "span",
    ]);
    expect(keys(createFunctionItem("a@1", "arrow", fn, at))).toEqual([
      "kind",
      "binding",
      "form",
      "function",
      "span",
    ]);
    expect(keys(createWatchItem([createRefSource("a@1", at)], fn, at))).toEqual([
      "kind",
      "sources",
      "callback",
      "span",
    ]);
    expect(
      keys(
        createWatchItem([createGetterSource(fn, at)], fn, at, {
          array: true,
          immediate: true,
          post: true,
        }),
      ),
    ).toEqual(["kind", "sources", "array", "callback", "immediate", "post", "span"]);
    expect(keys(createRefSource("a@1", at))).toEqual(["kind", "binding", "span"]);
    expect(keys(createGetterSource(fn, at))).toEqual(["kind", "getter", "span"]);
    expect(keys(createWatchEffectItem(fn, at))).toEqual(["kind", "effect", "span"]);
    expect(keys(createLifecycleItem("mounted", fn, at))).toEqual([
      "kind",
      "hook",
      "callback",
      "span",
    ]);
    expect(keys(createEmits("emit@1", type, [], at))).toEqual([
      "binding",
      "type",
      "events",
      "span",
    ]);
    expect(keys(createEventDeclaration("change", [], at))).toEqual(["name", "parameters", "span"]);
    expect(keys(createEventParameter("value", type, at))).toEqual(["name", "type", "span"]);
    expect(keys(createEventParameter("value", type, at, true))).toEqual([
      "name",
      "optional",
      "type",
      "span",
    ]);
    const handler = createFunctionHandler("a@1", at);
    expect(keys(handler)).toEqual(["kind", "binding", "span"]);
    expect(keys(createInlineHandler(fn, at))).toEqual(["kind", "function", "span"]);
    expect(keys(createEventAttribute("click", handler, at))).toEqual([
      "kind",
      "event",
      "handler",
      "span",
    ]);
    expect(
      keys(
        createEventAttribute("click", handler, at, { capture: true, once: true, passive: true }),
      ),
    ).toEqual(["kind", "event", "capture", "once", "passive", "handler", "span"]);
    expect(keys(createRefAttribute("a@1", at))).toEqual(["kind", "binding", "span"]);
  });
});

/** A node, briefly: its tag, its text in quotes, or its kind. */
function describeNode(node: VisitedNode): string {
  if (node.kind === "Element") return node.tag;
  if (node.kind === "Text") return `'${node.value}'`;
  return node.kind;
}

describe("walk", () => {
  it("visits nodes depth-first in document order, with their parents", () => {
    const visited: string[] = [];
    walk(sample().components[0]!.render, {
      enter(node, parent) {
        visited.push(`${describeNode(node)}<${parent ? describeNode(parent) : "root"}`);
      },
    });
    expect(visited).toEqual(["p<root", "'Hello'<p", "br<p", "'world'<p"]);
  });

  it("descends into the root fragment, every branch, list bodies and SVG", () => {
    const visited: string[] = [];
    walk(everyKind().components[0]!.render, {
      enter(node, parent) {
        visited.push(`${describeNode(node)}<${parent ? describeNode(parent) : "root"}`);
      },
    });
    expect(visited).toEqual([
      "Fragment<root",
      "p<Fragment",
      "'Hello, '<p",
      "Interpolation<p",
      "If<Fragment",
      "ul<If",
      "For<ul",
      "li<For",
      "Interpolation<li",
      "p<If",
      "'None'<p",
      "svg<Fragment",
      "circle<svg",
      "text<svg",
      "' '<text",
    ]);
  });

  it("skips the children of a node whose enter returns false", () => {
    const visited: string[] = [];
    walk(everyKind().components[0]!.render, {
      enter(node) {
        visited.push(describeNode(node));
        return node.kind === "Fragment" ? undefined : false;
      },
    });
    expect(visited).toEqual(["Fragment", "p", "If", "svg"]);
  });

  it("calls leave after the children", () => {
    const events: string[] = [];
    walk(sample().components[0]!.render, {
      enter: (node) => void events.push(`enter ${describeNode(node)}`),
      leave: (node) => void events.push(`leave ${describeNode(node)}`),
    });
    expect(events.at(0)).toBe("enter p");
    expect(events.at(-1)).toBe("leave p");
  });
});

describe("childrenOf", () => {
  it("gives every branch's children in order, a list's body, and nothing for text", () => {
    const render = everyKind().components[0]!.render;
    const [card, list] = childrenOf(render);
    expect(childrenOf(list!).map(describeNode)).toEqual(["ul", "p"]);
    const loop = childrenOf(childrenOf(list!)[0]!)[0]!;
    expect(childrenOf(loop).map(describeNode)).toEqual(["li"]);
    expect(childrenOf(childrenOf(card!)[0]!)).toEqual([]);
    expect(childrenOf(childrenOf(card!)[1]!)).toEqual([]);
  });
});

describe("collectFeatures", () => {
  it("collects the node and attribute kinds a module uses", () => {
    const features = collectFeatures(sample());
    expect([...features.nodeKinds].toSorted()).toEqual(["Element", "Text"]);
    expect([...features.attributeKinds]).toEqual(["Static"]);
    expect([...features.bindingKinds]).toEqual([]);
    expect([...features.setupItemKinds]).toEqual([]);
    expect([...features.handlerKinds]).toEqual([]);
    expect([...features.watchSourceKinds]).toEqual([]);
    expect([...features.codeReferenceKinds]).toEqual([]);
  });

  // A root fragment is no render node: the `fragment` capability covers it.
  it("collects every kind, binding kinds included, and no fragment", () => {
    const features = collectFeatures(everyKind());
    expect([...features.nodeKinds].toSorted()).toEqual([
      "Element",
      "For",
      "If",
      "Interpolation",
      "Text",
    ]);
    expect([...features.attributeKinds].toSorted()).toEqual([
      "Bound",
      "Class",
      "Event",
      "Ref",
      "Spread",
      "Static",
      "Style",
    ]);
    expect([...features.bindingKinds].toSorted()).toEqual([
      "derived",
      "emit",
      "localConst",
      "localFn",
      "localVar",
      "loopVar",
      "prop",
      "state",
      "templateRef",
    ]);
    expect([...features.setupItemKinds].toSorted()).toEqual([
      "Const",
      "Derived",
      "Function",
      "Id",
      "Lifecycle",
      "State",
      "TemplateRef",
      "Variable",
      "Watch",
      "WatchEffect",
    ]);
    expect([...features.handlerKinds].toSorted()).toEqual(["Function", "Inline"]);
    expect([...features.watchSourceKinds].toSorted()).toEqual(["Getter", "Ref"]);
    expect([...features.codeReferenceKinds].toSorted()).toEqual([
      "Api",
      "Binding",
      "Emit",
      "Event",
      "Global",
      "Write",
    ]);
  });

  it("counts the references of render expressions too", () => {
    const module = everyKind();
    module.components = [module.components[0]!];
    expect([...collectFeatures(module).codeReferenceKinds].toSorted()).toEqual([
      "Binding",
      "Global",
    ]);
  });
});

describe("expressionsOf", () => {
  it("finds every expression of a component, in document order, with its JSON pointer", () => {
    const component = everyKind().components[0]!;
    expect(
      expressionsOf(component, "/components/0").map((found) => [found.path, found.expression.code]),
    ).toEqual([
      ["/components/0/props/1/default", '"info"'],
      ["/components/0/render/children/0/attributes/0/items/1/condition", 'tone === "warn"'],
      ["/components/0/render/children/0/attributes/0/items/2/value", "tone"],
      ["/components/0/render/children/0/attributes/1/declarations/1/value", "label"],
      ["/components/0/render/children/0/attributes/2/value", "label.trim()"],
      ["/components/0/render/children/0/attributes/3/value", "attrs"],
      ["/components/0/render/children/0/children/1/value", "String(label)"],
      ["/components/0/render/children/1/branches/0/condition", "items.length > 0"],
      ["/components/0/render/children/1/branches/0/children/0/children/0/source", "items"],
      ["/components/0/render/children/1/branches/0/children/0/children/0/key", "index"],
      [
        "/components/0/render/children/1/branches/0/children/0/children/0/body/children/0/value",
        "item",
      ],
    ]);
  });

  it("points into the module from the component by default", () => {
    const [first] = expressionsOf(everyKind().components[0]!);
    expect(first!.path).toBe("/props/1/default");
  });

  // Setup code and handlers are codeOf's: a template reads only these (ADR-0045).
  it("finds only the template's expressions, not the setup's or the handlers' code", () => {
    expect(expressionsOf(everyKind().components[1]!).map((found) => found.expression.code)).toEqual(
      ["id", "id", "step", "label(doubled.value)", "items", "item", "item"],
    );
  });
});

/** The counter of {@link everyKind}: every kind of the setup. */
const counter = (): UfComponent => everyKind().components[1]!;

describe("functionsOf", () => {
  it("finds every function in source order, with its context and role", () => {
    expect(functionsOf(counter()).map(({ path, context, role }) => [path, context, role])).toEqual([
      ["/setup/1/getter", "pure", "getter"],
      ["/setup/6/function", "client", "function"],
      ["/setup/7/function", "client", "function"],
      ["/setup/8/function", "client", "function"],
      ["/setup/9/callback", "client", "watch"],
      ["/setup/10/sources/0/getter", "pure", "getter"],
      ["/setup/10/callback", "client", "watch"],
      ["/setup/11/effect", "client", "watchEffect"],
      ["/setup/12/callback", "client", "lifecycle"],
      ["/setup/13/callback", "client", "lifecycle"],
      ["/render/attributes/0/handler/function", "client", "handler"],
      ["/render/children/1/attributes/2/handler/function", "client", "handler"],
      ["/render/children/3/attributes/1/handler/function", "client", "handler"],
      [
        "/render/children/5/children/0/body/children/0/attributes/1/handler/function",
        "client",
        "handler",
      ],
    ]);
  });
});

describe("codeOf", () => {
  it("finds the setup's values and every function's body, then the handlers', with contexts", () => {
    expect(codeOf(counter(), "/components/1").map(({ path, context }) => [path, context])).toEqual([
      ["/components/1/setup/0/initial", "pure"],
      ["/components/1/setup/1/getter/body", "pure"],
      ["/components/1/setup/4/value", "pure"],
      ["/components/1/setup/6/function/body", "client"],
      ["/components/1/setup/7/function/body", "client"],
      ["/components/1/setup/8/function/body", "client"],
      ["/components/1/setup/9/callback/body", "client"],
      ["/components/1/setup/10/sources/0/getter/body", "pure"],
      ["/components/1/setup/10/callback/body", "client"],
      ["/components/1/setup/11/effect/body", "client"],
      ["/components/1/setup/12/callback/body", "client"],
      ["/components/1/setup/13/callback/body", "client"],
      ["/components/1/render/attributes/0/handler/function/body", "client"],
      ["/components/1/render/children/1/attributes/2/handler/function/body", "client"],
      [
        "/components/1/render/children/1/attributes/2/handler/function/eventControls/0/condition",
        "client",
      ],
      ["/components/1/render/children/3/attributes/1/handler/function/body", "client"],
      [
        "/components/1/render/children/5/children/0/body/children/0/attributes/1/handler/function/body",
        "client",
      ],
    ]);
  });

  it("finds nothing in a component without a setup or handlers", () => {
    expect(codeOf(everyKind().components[0]!)).toEqual([]);
    expect(functionsOf(everyKind().components[0]!)).toEqual([]);
  });
});

/** A summary's sets as arrays, for comparing. */
function plain(summary: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(summary).map(([key, value]) => [key, value instanceof Set ? [...value] : value]),
  );
}

describe("summarize", () => {
  it("summarises what each local function does", () => {
    const summaries = summarize(counter());
    expect([...summaries.keys()]).toEqual([
      counterIds.increment,
      counterIds.label,
      counterIds.select,
    ]);
    expect(plain(summaries.get(counterIds.increment)!)).toEqual({
      calls: [],
      reaches: [],
      reads: [counterIds.step, counterIds.count, counterIds.doubled],
      writes: [counterIds.count],
      emits: ["change"],
      api: false,
      async: false,
      readsTemplateRef: false,
      readsLocalVar: false,
      clientGlobals: [],
      escapes: false,
      eventControls: true,
    });
    expect(impurity(summaries.get(counterIds.increment)!)).toBe(`it writes "${counterIds.count}"`);
    expect(impurity(summaries.get(counterIds.label)!)).toBeUndefined();
    expect(impurity(summaries.get(counterIds.select)!)).toBe('it emits "change"');
  });

  // Each function's summary holds what the functions it reaches do, cycles included.
  it("follows calls transitively, and marks a function passed as a value", () => {
    const component = chain();
    const summaries = summarize(component);
    const [first, second, third] = ["first@10", "second@30", "third@50"];
    expect(plain(summaries.get(first)!)).toMatchObject({
      calls: [second],
      reaches: [second, third],
      reads: ["third@50", "timer@70", "input@80"],
      writes: [],
      async: true,
      api: true,
      readsTemplateRef: true,
      readsLocalVar: true,
      clientGlobals: ["setTimeout", "document"],
      escapes: false,
    });
    expect(plain(summaries.get(third)!)).toMatchObject({ reaches: [], escapes: true });
    expect(impurity(summaries.get(first)!)).toBe("it calls `nextTick`");
    // A piece of code is summarised as a function's body is.
    const [item] = component.setup;
    if (item?.kind !== "Function") throw new Error("the chain starts with a function");
    expect(plain(summarizeCode(item.function.body, component))).toMatchObject({
      reaches: [second, third],
      async: true,
    });
  });

  // What code hands on to run later is tracked by no target (ADR-0048): a `watchEffect` lists
  // only the rest as its dependencies, itself and through the functions it calls.
  it("leaves the references marked `later` out of what code tracks", () => {
    const component = chain();
    const [first, second] = component.setup;
    if (first?.kind !== "Function" || second?.kind !== "Function") {
      throw new Error("the chain starts with two functions");
    }
    const [call] = first.function.body.refs;
    const [, third] = second.function.body.refs;
    if (call?.kind !== "Binding" || third?.kind !== "Binding") throw new Error("two calls");
    third.later = true;
    expect(plain(summarizeTracked(first.function.body, component))).toMatchObject({
      reaches: ["second@30"],
      reads: ["third@50"],
      readsLocalVar: false,
      readsTemplateRef: false,
    });
    call.later = true;
    expect(plain(summarizeTracked(first.function.body, component))).toMatchObject({
      reaches: [],
      reads: ["third@50"],
    });
    // The summary of all the code still holds it.
    expect(plain(summarizeCode(first.function.body, component))).toMatchObject({
      reaches: ["second@30", "third@50"],
    });
  });
});

/**
 * A component whose functions call one another: `first` calls `second`, which awaits `nextTick`
 * and calls the `async` `third`, which reads a setup `let`, a template ref and `document`; and
 * `first` passes `third` to `setTimeout`.
 */
function chain(): UfComponent {
  const fn = (code: string, start: number, refs: Parameters<typeof createCode>[2], async = false) =>
    createFunctionCode(
      [],
      createCode(code, span(start, start + code.length), refs),
      span(start - 6, start + code.length),
      {
        expression: true,
        async,
      },
    );
  const ref = (binding: string, start: number, length: number, call = false) =>
    createBindingReference(binding, span(start, start + length), false, call);
  return createComponent(
    "Chain",
    createElement("p", [], [], span(200, 210)),
    span(0, 300),
    [],
    undefined,
    [],
    [
      { id: "first@10", name: "first", kind: "localFn", span: span(10, 15) },
      { id: "second@30", name: "second", kind: "localFn", span: span(30, 36) },
      { id: "third@50", name: "third", kind: "localFn", span: span(50, 55) },
      { id: "timer@70", name: "timer", kind: "localVar", span: span(70, 75) },
      { id: "input@80", name: "input", kind: "templateRef", span: span(80, 85) },
    ],
    [
      createFunctionItem(
        "first@10",
        "arrow",
        fn("second() + setTimeout(third)", 100, [
          ref("second@30", 100, 6, true),
          createGlobalReferenceAt("setTimeout", 111),
          ref("third@50", 122, 5),
        ]),
        span(10, 130),
      ),
      createFunctionItem(
        "second@30",
        "arrow",
        fn("nextTick() + third()", 140, [
          createApiReference("nextTick", span(140, 148)),
          ref("third@50", 153, 5, true),
        ]),
        span(30, 160),
      ),
      createFunctionItem(
        "third@50",
        "arrow",
        fn(
          "timer + input.value + document",
          170,
          [
            ref("timer@70", 170, 5),
            ref("input@80", 178, 11),
            createGlobalReferenceAt("document", 192),
          ],
          true,
        ),
        span(50, 200),
      ),
    ],
  );
}

/** A global's reference at an offset. */
function createGlobalReferenceAt(name: string, start: number) {
  return { kind: "Global" as const, name, span: span(start, start + name.length) };
}

/** The value at a JSON pointer. */
function valueAt(value: unknown, pointer: string): unknown {
  return pointer
    .split("/")
    .slice(1)
    .reduce<unknown>((parent, key) => (parent as Record<string, unknown>)[key], value);
}

describe("spansOf", () => {
  it("finds every span in the module, each at its pointer", () => {
    const module = everyKind();
    const located = spansOf(module);
    for (const entry of located) expect(valueAt(module, entry.path), entry.path).toBe(entry.span);
    // Every span, found by a blind walk of the JSON, is among them: a `span`, and a write's
    // target and value and an emit's arguments.
    const blind: string[] = [];
    const isSpan = (value: object) =>
      Object.keys(value).join() === "start,end" &&
      Object.values(value).every((item) => typeof item === "number");
    const visit = (value: unknown, path: string): void => {
      if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}/${index}`));
      else if (value && typeof value === "object") {
        if (isSpan(value)) blind.push(path);
        else for (const [key, item] of Object.entries(value)) visit(item, `${path}/${key}`);
      }
    };
    visit(module, "");
    expect(located.map(({ path }) => path).toSorted()).toEqual(blind.toSorted());
  });
});
