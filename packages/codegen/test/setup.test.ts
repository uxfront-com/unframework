// The kit over a whole M2 component: the IR package's `Counter` fixture uses every kind of setup
// item, listener, handler and template ref (packages/ir/test/fixtures.ts), so capabilities, names,
// the bindings printed code reads and the functions printed from their parts are checked on the
// shapes the analyser produces.
import {
  createBinding,
  createComponent,
  createConstItem,
  createElement,
  createEmits,
  createEventAttribute,
  createEventDeclaration,
  createEventParameter,
  createFor,
  createFunctionCode,
  createInlineHandler,
  createInterpolation,
  createModule,
  createProp,
  createPropsParameter,
  createStateItem,
  createTypeDeclaration,
  createTypeText,
  functionsOf,
  span,
  walk,
} from "@unframework/ir";
import type {
  ApiReference,
  ElementNode,
  EventAttribute,
  ForNode,
  LifecycleItem,
  UfComponent,
  UfModule,
} from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import { COUNTER, everyKind, find } from "../../ir/test/fixtures.ts";
import {
  BEHAVIOURAL_CAPABILITIES,
  CAPABILITY_NAMES,
  CAPABILITY_PREREQUISITES,
  functionBodyText,
  functionText,
  handlerText,
  liveBindings,
  liveTypes,
  parameterText,
  referencedBindings,
  requiredCapabilities,
  sourceNames,
  typeNames,
} from "../src/index.ts";
import type { RewriteRules } from "../src/index.ts";
import { codeAt, expressionAt } from "./expressions.ts";

const module = (): UfModule => everyKind();
const counter = (): UfComponent => module().components[1]!;

/** Where the counter's source starts in the module's source. */
const OFFSET = find("export function Counter").start;
/** The counter's source at a span of the module. */
const sourceAt = ({ start, end }: { start: number; end: number }) =>
  COUNTER.slice(start - OFFSET, end - OFFSET);

/** The names of a set of binding ids, sorted. */
const names = (ids: Iterable<string>) =>
  [...ids].map((id) => id.slice(0, id.lastIndexOf("@"))).toSorted();

/** Every element of a render tree, in document order. */
function elements(component: UfComponent): ElementNode[] {
  const found: ElementNode[] = [];
  walk(component.render, {
    enter(node) {
      if (node.kind === "Element") found.push(node);
    },
  });
  return found;
}

describe("requiredCapabilities over setup code and listeners", () => {
  it("derives each capability where the component first uses it, setup before render", () => {
    const component = counter();
    const [root, label, input, increment, reset] = elements(component);
    const event = (element: ElementNode, index: number) =>
      element.attributes[index] as EventAttribute;
    const mounted = component.setup[12] as LifecycleItem;
    const tick = mounted.callback.body.refs.find(
      (reference): reference is ApiReference => reference.kind === "Api",
    )!;
    let list: ForNode | undefined;
    walk(component.render, {
      enter(node) {
        if (node.kind === "For") list = node;
      },
    });
    expect([...requiredCapabilities(createModule("Counter.uf.tsx", [component]))]).toEqual([
      ["props", component.propsParameter!.span],
      ["use-id", component.setup[3]!.span],
      ["interactivity", component.setup[9]!.span],
      ["next-tick", tick.span],
      ["element", root!.span],
      ["event-semantics", event(root!, 0).span],
      ["event-passive", event(root!, 0).span],
      ["bound-attribute", label!.attributes[0]!.span],
      ["text", label!.children[0]!.span],
      ["static-attribute", increment!.attributes[0]!.span],
      ["event-capture", event(increment!, 2).span],
      // A capture listener's control on an element that also listens in the bubble phase.
      ["conditional-event-control", event(increment!, 2).span],
      ["interpolation", increment!.children[1]!.span],
      ["event-once", event(reset!, 1).span],
      ["list", list!.span],
    ]);
    expect(input!.attributes.map((attribute) => attribute.kind)).toEqual(["Bound", "Ref", "Event"]);
  });

  it("derives interactivity from a listener, or from a template ref alone", () => {
    const component = counter();
    const [root, , input] = elements(component);
    const bare: UfComponent = { ...component, setup: [] };
    const derived = () => requiredCapabilities(createModule("Counter.uf.tsx", [bare]));
    expect(derived().get("interactivity")).toEqual(root!.attributes[0]!.span);
    expect(derived().has("use-id")).toBe(false);
    expect(derived().has("next-tick")).toBe(false);
    // Without its listeners, the input's template ref is the first thing that runs in the browser.
    walk(bare.render, {
      enter(node) {
        if (node.kind === "Element") {
          node.attributes = node.attributes.filter((attribute) => attribute.kind !== "Event");
        }
      },
    });
    expect(derived().get("interactivity")).toEqual(input!.attributes[1]!.span);
    expect(derived().has("event-semantics")).toBe(false);
  });

  it("names the behavioural capabilities and their prerequisites among the capabilities", () => {
    for (const capability of BEHAVIOURAL_CAPABILITIES) {
      expect(CAPABILITY_NAMES).toContain(capability);
    }
    // Each refines `interactivity` and is behavioural, but reactive context, which refines
    // `context` and changes what renders (ADR-0055).
    for (const [capability, prerequisite] of Object.entries(CAPABILITY_PREREQUISITES)) {
      if (capability === "reactive-context") {
        expect(prerequisite).toBe("context");
        expect(BEHAVIOURAL_CAPABILITIES.has(capability)).toBe(false);
      } else {
        expect(BEHAVIOURAL_CAPABILITIES.has(capability as never)).toBe(true);
        expect(prerequisite).toBe("interactivity");
      }
    }
    expect(BEHAVIOURAL_CAPABILITIES.has("use-id")).toBe(false);
  });
});

describe("referencedBindings over setup code and listeners", () => {
  it("counts every binding code reads, writes, emits through, calls or attaches", () => {
    const component = counter();
    expect(names(referencedBindings(component))).toEqual(
      names(component.bindings.map((binding) => binding.id)),
    );
  });

  it("counts only the template and what the setup evaluates without client code", () => {
    expect(names(referencedBindings(counter(), { includeClient: false }))).toEqual(
      ["count", "doubled", "id", "item", "items", "label", "start", "step"].toSorted(),
    );
  });

  it("counts what a list's handlers read in the list", () => {
    let list: ForNode | undefined;
    walk(counter().render, {
      enter(node) {
        if (node.kind === "For") list = node;
      },
    });
    expect(names(referencedBindings(list!))).toEqual(["item", "items", "select"]);
    expect(names(referencedBindings(list!, { includeClient: false }))).toEqual(["item", "items"]);
  });
});

describe("liveBindings", () => {
  it("follows the template's reads through the setup without client code", () => {
    expect(names(liveBindings(counter(), { client: false }))).toEqual(
      ["count", "doubled", "id", "item", "items", "label", "start", "step"].toSorted(),
    );
  });

  it("reaches every binding from listeners, refs, watchers, effects and hooks", () => {
    const component = counter();
    expect(names(liveBindings(component, { client: true }))).toEqual(
      names(component.bindings.map((binding) => binding.id)),
    );
  });

  it("leaves out a declaration nothing printed reads", () => {
    const component = counter();
    // Without its listeners, nothing calls `increment` or `select`, and nothing reads `timer` or
    // `emit` but the setup's own client code.
    const silent = {
      ...component,
      setup: component.setup.filter((item) => item.kind !== "Watch" && item.kind !== "Lifecycle"),
    };
    walk(silent.render, {
      enter(node) {
        if (node.kind === "Element") {
          node.attributes = node.attributes.filter((attribute) => attribute.kind !== "Event");
        }
      },
    });
    expect(names(liveBindings(silent, { client: true }))).toEqual(
      ["count", "doubled", "id", "input", "item", "items", "label", "start", "step"].toSorted(),
    );
  });
});

describe("liveBindings and liveTypes without the lists' keys", () => {
  // <ul>{items.map((item) => <li key={`${prefix}-${item}`}>{item}</li>)}</ul>, where `prefix` is
  // a const of the setup that reads a prop, `scope`, and names a type: only the key reads them.
  const at = (start: number) => span(start, start + 1);
  const items = createBinding("items", "prop", at(1));
  const scope = createBinding("scope", "prop", at(2));
  const prefix = createBinding("prefix", "localConst", at(10));
  const item = createBinding("item", "loopVar", at(40));
  const list = createFor(
    expressionAt(30, "items", ["items", items]),
    item.id,
    expressionAt(50, "`${prefix}-${item}`", ["prefix", prefix], ["item", item]),
    createElement(
      "li",
      [],
      [createInterpolation(expressionAt(70, "item", ["item", item]), at(69))],
      at(45),
    ),
    at(29),
  );
  const component = createComponent(
    "List",
    createElement("ul", [], [list], at(20)),
    at(0),
    [
      createProp("items", false, createTypeText("string[]", at(3)), at(1), items.id),
      createProp("scope", false, createTypeText("string", at(4)), at(2), scope.id),
    ],
    createPropsParameter("destructured", createTypeText("Props", at(5)), at(5)),
    ["Props", "Prefix"],
    [items, scope, prefix, item],
    [createConstItem(prefix.id, codeAt(12, "scope as Prefix", ["scope", scope]), at(10))],
  );
  const module = createModule(
    "List.uf.tsx",
    [component],
    [],
    [
      createTypeDeclaration(
        "Props",
        false,
        "interface Props { items: string[]; scope: string }",
        at(6),
      ),
      createTypeDeclaration("Prefix", false, "type Prefix = string", at(7)),
    ],
  );

  it("counts what only a key reads by default, as every target but Astro prints keys", () => {
    expect(names(liveBindings(component, { client: false }))).toEqual(
      ["item", "items", "prefix", "scope"].toSorted(),
    );
    expect(liveTypes(component, module, { client: false }).map(({ name }) => name)).toEqual([
      "Props",
      "Prefix",
    ]);
  });

  it("leaves it out with `includeKeys: false`", () => {
    expect(names(liveBindings(component, { client: false, includeKeys: false }))).toEqual([
      "item",
      "items",
    ]);
    expect(
      liveTypes(component, module, { client: false, includeKeys: false }).map(({ name }) => name),
    ).toEqual(["Props"]);
  });
});

describe("sourceNames over setup code", () => {
  it("reserves what setup code and handlers declare and read, parameters and annotations' types", () => {
    const whole = module();
    expect([...sourceNames(whole.components[1]!, whole)].toSorted()).toEqual(
      [
        "Attrs",
        "Counter",
        "HTMLInputElement",
        "MouseEvent",
        "String",
        "clearInterval",
        "console",
        "count",
        "doubled",
        "emit",
        "entry",
        "event",
        "id",
        "increment",
        "input",
        "item",
        "items",
        "label",
        "nextTick",
        "onCleanup",
        "previous",
        "rest",
        "select",
        "setInterval",
        "start",
        "step",
        "suffix",
        "timer",
        "unit",
        "value",
      ].toSorted(),
    );
  });

  it("reads the names a type annotation reads, not its keys or labels", () => {
    expect(
      [...typeNames("{ change: [value: Item, at?: Date]; map: Map<string, Ns.Kind> }")].toSorted(),
    ).toEqual(["Date", "Item", "Map", "Ns"]);
  });

  it.each([
    ["value is Size", ["Size"]],
    ["asserts value is Map<string, Item>", ["Item", "Map"]],
    ["asserts value", []],
    ["this is Panel", ["Panel"]],
  ])("reads the names the type predicate %s asserts, not its parameter", (type, expected) => {
    expect([...typeNames(type)].toSorted()).toEqual(expected);
  });
});

/** An AST's shape: its nodes without their positions, to compare code that differs in layout. */
function shape(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(shape);
  if (typeof node !== "object" || node === null) return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== "start" && key !== "end" && key !== "range")
      .map(([key, value]) => [key, shape(value)]),
  );
}

/** The shape of a module's statements, for code that parses as a module. */
const statementShape = (code: string) => {
  const parsed = parseModule("Function.tsx", code);
  expect(parsed.errors, code).toEqual([]);
  return shape(parsed.program.body);
};

describe("functionText", () => {
  it("prints every function of the counter back as the source writes it", () => {
    const component = counter();
    const located = functionsOf(component);
    expect(located.map(({ role }) => role)).toEqual([
      "getter",
      "function",
      "function",
      "function",
      "watch",
      "getter",
      "watch",
      "watchEffect",
      "lifecycle",
      "lifecycle",
      "handler",
      "handler",
      "handler",
      "handler",
    ]);
    for (const { function: fn, path } of located) {
      const item = component.setup[Number(/^\/setup\/(\d+)\/function$/.exec(path)?.[1] ?? -1)];
      if (item?.kind === "Function" && item.form === "declaration") {
        const name = component.bindings.find((binding) => binding.id === item.binding)!.name;
        const printed = functionText(fn, component, undefined, "client", { name });
        expect(statementShape(printed), printed).toEqual(statementShape(sourceAt(item.span)));
      } else {
        const printed = functionText(fn, component, undefined, "client");
        expect(statementShape(`(${printed});`), printed).toEqual(
          statementShape(`(${sourceAt(fn.span)});`),
        );
      }
    }
  });

  it("prints parameters exactly as written: rest, optional, patterns, types and defaults", () => {
    const label = counter().setup[7]!;
    if (label.kind !== "Function") throw new Error("The counter's eighth item is `label`.");
    expect(label.function.parameters.map(parameterText)).toEqual(
      label.function.parameters.map(({ span }) => sourceAt(span)),
    );
    expect(label.function.parameters.map(parameterText)).toEqual([
      "value: number",
      '[unit]: string[] = ["x"]',
      "suffix?: string",
      "...rest: string[]",
    ]);
  });

  it("rewrites the body for its site, and writes declarations and arrows on request", () => {
    const component = counter();
    const increment = component.setup[6]!;
    if (increment.kind !== "Function") throw new Error("The counter's seventh item is a function.");
    const angular: RewriteRules = {
      binding: (_, binding, written, site) =>
        site === "client" && binding.kind !== "prop" ? `this.${binding.name}()` : written,
      write: (_, binding, parts) => `this.${binding.name}.set(${parts.target} + ${parts.value})`,
      emit: (emitted, _, parts) => `this.${emitted.event}.emit(${parts.arguments.join(", ")})`,
    };
    expect(functionText(increment.function, component, angular, "client")).toBe(
      [
        "(event: MouseEvent) => {",
        "    event.preventDefault();",
        "    this.count.set(this.count() + this.step());",
        "    this.change.emit(this.count(), this.doubled());",
        "  }",
      ].join("\n"),
    );
    expect(
      functionText(increment.function, component, undefined, "client", { name: "increment" }),
    ).toBe(`function increment${sourceAt(increment.function.span)}`);
    expect(functionText(increment.function, component, undefined, "client", { arrow: false })).toBe(
      `function${sourceAt(increment.function.span)}`,
    );
  });

  it("parenthesises an arrow's object literal or sequence body, and returns a declaration's", () => {
    const component = counter();
    const unmounted = component.setup[13]!;
    if (unmounted.kind !== "Lifecycle") throw new Error("The counter's last item is a hook.");
    const fn = unmounted.callback;
    const object = { ...fn, body: { ...fn.body, code: "{ ...timer }", refs: [] } };
    const sequence = { ...fn, body: { ...fn.body, code: "a, b", refs: [] } };
    expect(functionText(object, component, undefined, "client")).toBe("() => ({ ...timer })");
    expect(functionText(sequence, component, undefined, "client")).toBe("() => (a, b)");
    expect(functionText(fn, component, undefined, "client", { name: "stop" })).toBe(
      "function stop() {\n  return clearInterval(timer);\n}",
    );
  });
});

describe("functionBodyText", () => {
  it("gives a block's statements, or an expression body's return or statement", () => {
    const component = counter();
    const select = component.setup[8]!;
    const unmounted = component.setup[13]!;
    if (select.kind !== "Function" || unmounted.kind !== "Lifecycle") {
      throw new Error("The counter's ninth item is `select`, its last a hook.");
    }
    expect(functionBodyText(select.function, component, undefined, "client")).toBe(
      'emit("change", entry.length);',
    );
    expect(functionBodyText(unmounted.callback, component, undefined, "client")).toBe(
      "return clearInterval(timer);",
    );
    expect(
      functionBodyText(unmounted.callback, component, undefined, "client", { discard: true }),
    ).toBe("clearInterval(timer);");
    const object = {
      ...unmounted.callback,
      body: { ...unmounted.callback.body, code: "{ a: 1 }", refs: [] },
    };
    expect(functionBodyText(object, component, undefined, "client", { discard: true })).toBe(
      "({ a: 1 });",
    );
  });
});

describe("handlerText", () => {
  it("spells a named handler as the rules spell its function, and prints an inline one", () => {
    const component = counter();
    const [, , input, increment] = elements(component);
    const named = (increment!.attributes[1] as EventAttribute).handler;
    const inline = (input!.attributes[2] as EventAttribute).handler;
    expect(handlerText(named, component, undefined)).toBe("increment");
    const methods: RewriteRules = {
      binding: (_, binding, written, site) =>
        binding.kind === "localFn" && site === "client" ? `this.${binding.name}` : written,
    };
    expect(handlerText(named, component, methods)).toBe("this.increment");
    expect(handlerText(inline, component, undefined)).toBe(
      '(event) => { if (event.key === "Escape") event.preventDefault(); }',
    );
  });
});

describe("liveTypes", () => {
  // A component whose types are each reached one way: the props', a live state's annotation
  // (and what its declaration names), an export, an event's payload and a handler's code.
  const at = (start: number) => span(start, start + 1);
  const declarations = [
    createTypeDeclaration("Props", false, "interface Props { start: number }", at(1)),
    createTypeDeclaration("Item", false, "interface Item { tag: Tag }", at(2)),
    createTypeDeclaration("Tag", false, 'type Tag = "a" | "b"', at(3)),
    createTypeDeclaration("Shared", true, "interface Shared { id: string }", at(4)),
    createTypeDeclaration("Payload", false, "interface Payload { at: number }", at(5)),
    createTypeDeclaration("Hidden", false, "type Hidden = { x: number }", at(6)),
    createTypeDeclaration("Elsewhere", false, "type Elsewhere = string", at(7)),
  ];
  const items = createBinding("items", "state", at(20));
  const emit = createBinding("emit", "emit", at(30));
  const read = expressionAt(100, "items.value.length", ["items.value", items]);
  const handler = codeAt(200, 'emit("change", { at: 1 } as Hidden)', {
    emit: 'emit("change", { at: 1 } as Hidden)',
    binding: emit,
    event: "change",
    arguments: ["{ at: 1 } as Hidden"],
  });
  const component = createComponent(
    "List",
    createElement(
      "button",
      [
        createEventAttribute(
          "click",
          createInlineHandler(
            createFunctionCode([], handler, at(199), { expression: true }),
            at(199),
          ),
          at(198),
        ),
      ],
      [createInterpolation(read, at(99))],
      at(90),
    ),
    at(10),
    [],
    createPropsParameter("destructured", createTypeText("Props", at(11)), at(11)),
    ["Props", "Item", "Tag", "Shared", "Payload", "Hidden"],
    [items, emit],
    [createStateItem(items.id, at(21), codeAt(25, "[]"), createTypeText("Item[]", at(22)))],
    createEmits(
      emit.id,
      createTypeText("{ change: [value: Payload] }", at(31)),
      [
        createEventDeclaration(
          "change",
          [createEventParameter("value", createTypeText("Payload", at(33)), at(32))],
          at(32),
        ),
      ],
      at(30),
    ),
  );
  const module = createModule("List.uf.tsx", [component], [], declarations);
  const names = (found: { name: string }[]) => found.map(({ name }) => name);

  it("keeps what the template, the live setup and the exports reach, without client code", () => {
    expect(names(liveTypes(component, module, { client: false }))).toEqual([
      "Props",
      "Item",
      "Tag",
      "Shared",
    ]);
  });

  it("keeps what events and handlers reach too, with client code", () => {
    expect(names(liveTypes(component, module, { client: true }))).toEqual([
      "Props",
      "Item",
      "Tag",
      "Shared",
      "Payload",
      "Hidden",
    ]);
  });
});
