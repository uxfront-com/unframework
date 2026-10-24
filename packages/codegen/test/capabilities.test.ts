import {
  createBinding,
  createBindingReference,
  createBoundAttribute,
  createBoundStyle,
  createBranch,
  createClassAttribute,
  createComponent,
  createComponentNode,
  createDynamicClass,
  createElement,
  createExpression,
  createFor,
  createFragment,
  createIf,
  createImportedName,
  createInterpolation,
  createModule,
  createModuleImport,
  createProp,
  createPropsParameter,
  createSpreadAttribute,
  createSpreadKey,
  createStaticAttribute,
  createStyleAttribute,
  createText,
  createTypeText,
} from "@unframework/ir";
import {
  createApiReference,
  createCode,
  createDerivedItem,
  createDynamicNode,
  createEventAttribute,
  createExposes,
  createFunctionCode,
  createFunctionHandler,
  createGetterSource,
  createIdItem,
  createInlineHandler,
  createLifecycleItem,
  createParameter,
  createRefAttribute,
  createSlotFill,
  createSlotReference,
  createStaticClass,
  createStaticStyle,
  createStyleSheet,
  createWatchEffectItem,
  createWatchItem,
} from "@unframework/ir";
import type {
  ComponentApi,
  ComponentNode,
  ElementNode,
  IfNode,
  ModelAttribute,
  ModuleApi,
  ProvideItem,
  SlotOutletNode,
  UfModule,
} from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { composition, find } from "../../ir/test/composition-fixture.ts";
import { everyKind } from "../../ir/test/fixtures.ts";
import * as m5 from "../../ir/test/modules-fixture.ts";
import {
  CAPABILITY_NAMES,
  composableUse,
  compositionUse,
  requiredCapabilities,
} from "../src/index.ts";

const at = (start: number) => ({ start, end: start + 1 });

/** `label`, a reference to the prop of that name, at `start`. */
const label = (start: number) =>
  createExpression("label", { start, end: start + 5 }, [
    createBindingReference("label@10", { start, end: start + 5 }),
  ]);
/** `item`, a reference to the loop variable of that name, at `start`. */
const item = (start: number) =>
  createExpression("item", { start, end: start + 4 }, [
    createBindingReference("item@50", { start, end: start + 4 }),
  ]);

describe("requiredCapabilities", () => {
  it("derives each capability a module uses, with where it is first used", () => {
    const first = createElement(
      "div",
      [],
      [
        createText("a", at(1)),
        createElement(
          "select",
          [createStaticAttribute("name", "s", at(3)), createStaticAttribute("size", "2", at(4))],
          [createElement("option", [], [createText("x", at(6))], at(5))],
          at(2),
        ),
      ],
      at(0),
    );
    const second = createElement(
      "select",
      [createStaticAttribute("size", "3", at(11))],
      [createElement("option", [], [], at(12))],
      at(10),
    );
    const module = createModule(
      "Choice.uf.tsx",
      [createComponent("First", first, at(0)), createComponent("Second", second, at(10))],
      [],
    );
    expect([...requiredCapabilities(module)]).toEqual([
      ["element", at(0)],
      ["text", at(1)],
      ["static-attribute", at(3)],
      ["listbox", at(4)],
    ]);
  });

  // Each of M1's capabilities, derived where the module first uses it: props at the props
  // parameter, a fragment at the root, SVG at its `<svg>`, and the node and attribute kinds.
  it("derives M1's capabilities, each where it is first used", () => {
    const card = createElement(
      "p",
      [
        createClassAttribute([createDynamicClass(label(100), at(100))], at(99)),
        createStyleAttribute([createBoundStyle("color", label(110), at(110))], at(109)),
        createBoundAttribute("title", label(120), at(119)),
        createSpreadAttribute(label(130), [createSpreadKey("id", at(20))], false, at(129)),
        createStaticAttribute("id", "x", at(139)),
      ],
      [createInterpolation(label(150), at(149))],
      at(98),
    );
    const list = createIf(
      [
        createBranch(
          label(160),
          [
            createElement(
              "select",
              [createBoundAttribute("size", label(171), at(170))],
              [
                createFor(
                  label(180),
                  "item@50",
                  item(190),
                  createElement("option", [], [], at(195)),
                  at(179),
                ),
              ],
              at(169),
            ),
          ],
          at(159),
        ),
      ],
      at(158),
    );
    const icon = createElement("svg", [], [createText("x", at(210))], at(200));
    const type = createTypeText("P", at(30));
    const module = createModule(
      "Card.uf.tsx",
      [
        createComponent("Plain", createElement("hr", [], [], at(2)), at(1)),
        createComponent(
          "Card",
          createFragment([card, list, icon], at(97)),
          at(5),
          [createProp("label", false, type, at(10), "label@10")],
          createPropsParameter("destructured", type, at(9)),
          [],
          [createBinding("label", "prop", at(10)), createBinding("item", "loopVar", at(50))],
        ),
      ],
      [],
    );
    expect([...requiredCapabilities(module)]).toEqual([
      ["element", at(2)],
      ["props", at(9)],
      ["fragment", at(97)],
      ["class-binding", at(99)],
      ["style-binding", at(109)],
      ["bound-attribute", at(119)],
      ["attribute-spread", at(129)],
      ["static-attribute", at(139)],
      ["interpolation", at(149)],
      ["conditional", at(158)],
      ["listbox", at(170)],
      ["list", at(179)],
      ["svg", at(200)],
      ["text", at(210)],
    ]);
  });

  it("derives props from the first prop when there is no parameter to point at", () => {
    const type = createTypeText("P", at(30));
    const component = createComponent("A", createElement("p", [], [], at(2)), at(1), [
      createProp("label", false, type, at(10)),
    ]);
    expect(requiredCapabilities(createModule("A.uf.tsx", [component])).get("props")).toEqual(
      at(10),
    );
  });

  it("derives no props for a component whose props type is empty", () => {
    const component = createComponent(
      "A",
      createElement("p", [], [], at(2)),
      at(1),
      [],
      createPropsParameter("destructured", createTypeText("P", at(30)), at(9)),
    );
    expect(requiredCapabilities(createModule("A.uf.tsx", [component])).has("props")).toBe(false);
  });

  // M2's capabilities (ADR-0047): `interactivity` at the first effect, hook, listener or template
  // ref, each listener option at the first listener with it, `use-id` and `next-tick` at their
  // first use, the setup's before the template's.
  it("derives M2's capabilities, each where it is first used", () => {
    const fn = (start: number, refs: Parameters<typeof createCode>[2] = []) =>
      createFunctionCode([], createCode("x", at(start), refs), at(start), { expression: true });
    const listener = (start: number, options: Parameters<typeof createEventAttribute>[3]) =>
      createEventAttribute(
        "click",
        createFunctionHandler("save@10", at(start)),
        at(start),
        options,
      );
    const button = createElement(
      "button",
      [
        listener(300, { once: true }),
        createEventAttribute(
          "click",
          createInlineHandler(fn(310, [createApiReference("nextTick", at(311))]), at(310)),
          at(309),
        ),
        listener(320, { passive: true }),
        listener(330, { capture: true }),
        listener(340, { once: true }),
      ],
      [],
      at(299),
    );
    const effects = createComponent(
      "Effects",
      createElement("p", [], [], at(200)),
      at(100),
      [],
      undefined,
      [],
      [],
      [
        createWatchEffectItem(fn(110), at(109)),
        createIdItem("id@120", at(120)),
        createLifecycleItem("mounted", fn(131, [createApiReference("nextTick", at(132))]), at(130)),
      ],
    );
    const handlers = createComponent("Handlers", button, at(290));
    expect([...requiredCapabilities(createModule("A.uf.tsx", [effects, handlers]))]).toEqual([
      ["interactivity", at(109)],
      ["use-id", at(120)],
      ["next-tick", at(132)],
      ["element", at(200)],
      ["event-semantics", at(300)],
      ["event-once", at(300)],
      ["event-passive", at(320)],
      ["event-capture", at(330)],
    ]);
    // Alone, the handlers' component derives `interactivity` at its first listener, and
    // `next-tick` in an inline handler.
    expect([...requiredCapabilities(createModule("B.uf.tsx", [handlers]))].slice(0, 5)).toEqual([
      ["element", at(299)],
      ["interactivity", at(300)],
      ["event-semantics", at(300)],
      ["event-once", at(300)],
      ["next-tick", at(311)],
    ]);
  });

  // An optional prop that a derived value, a watch source or a `watchEffect` reads (ADR-0046):
  // a parent's spread may pass it only after the component mounted.
  it("derives late-prop where a derived value or a watcher reads an optional prop", () => {
    const read = (prop: string, start: number) =>
      createFunctionCode(
        [],
        createCode(prop, at(start), [createBindingReference(`${prop}@10`, at(start))]),
        at(start),
        { expression: true },
      );
    const component = (setup: Parameters<typeof createComponent>[7]) =>
      createComponent(
        "Pages",
        createElement("p", [], [], at(200)),
        at(1),
        [
          createProp("page", true, createTypeText("number", at(5)), at(4), "page@10"),
          createProp("total", false, createTypeText("number", at(7)), at(6), "total@10"),
        ],
        createPropsParameter("destructured", createTypeText("P", at(9)), at(3)),
        [],
        [],
        setup,
      );
    const derives = (setup: Parameters<typeof createComponent>[7]) =>
      requiredCapabilities(createModule("A.uf.tsx", [component(setup)])).get("late-prop");
    expect(derives([createDerivedItem("label@100", read("page", 110), at(100))])).toEqual(at(110));
    expect(
      derives([
        createWatchItem(
          [createGetterSource(read("page", 120), at(120))],
          read("total", 130),
          at(119),
        ),
      ]),
    ).toEqual(at(120));
    expect(derives([createWatchEffectItem(read("page", 140), at(139))])).toEqual(at(140));
    // A required prop, and an optional one read only where nothing subscribes (a watch
    // callback), need nothing.
    expect(derives([createDerivedItem("label@100", read("total", 110), at(100))])).toBeUndefined();
    expect(
      derives([
        createWatchItem(
          [createGetterSource(read("total", 120), at(120))],
          read("page", 130),
          at(119),
        ),
      ]),
    ).toBeUndefined();
  });

  it("names each capability once", () => {
    expect(new Set(CAPABILITY_NAMES).size).toBe(CAPABILITY_NAMES.length);
  });
});

// Composition (ADR-0055): each kind's capability where it is first used, and `interactivity`
// beside a component's model, listener and ref and an element's `v-model`.
describe("requiredCapabilities over composition", () => {
  it("derives composition's capabilities, each where it is first used", () => {
    const field = find("<Field").start;
    expect([...requiredCapabilities(composition())]).toEqual([
      ["props", find("{ label }: { label: string }")],
      ["model", find('const open = defineModel<boolean>("open");')],
      ["context", find("const theme = inject(ThemeKey);")],
      ["named-slot", find("slots.title")],
      ["element", { start: find("<div>").start, end: find("</div>").end }],
      ["conditional", find("{slots.title && <h2>{theme}</h2>}")],
      ["interpolation", find("{theme}")],
      ["component", { start: field, end: find("</Field>").end }],
      ["interactivity", find("v-model:value={text.value}")],
      ["component-event", find("onClear={() => (open.value = false)}")],
      // The fixture's `Field` is styled, and its sheets use `:slotted()` (ADR-0063).
      ["slotted-styles", find("{label}", 0, find(">{label}").start)],
      ["default-slot", find("{label}", 0, find(">{label}").start)],
      ["two-way-binding", find("v-model={text.value}", 0, find("<input").start)],
      ["slot-fallback", find("{slots.default?.() ?? label}")],
    ]);
  });

  it("derives reactive context, a contextual root, exposes and a v-model's array and modifiers", () => {
    const module = composition();
    const form = module.components[0]!;
    const provide = form.setup[3] as ProvideItem;
    const value = find("text.value");
    provide.value = createCode("text.value", value, [
      createBindingReference(form.bindings[2]!.id, value),
    ]);
    form.exposes = createExposes([], find("const slots"));
    const input = (form.render as ElementNode).children[2] as ElementNode;
    const model = input.attributes[0] as ModelAttribute;
    model.control = "checkbox-group";
    model.trim = true;
    const required = requiredCapabilities(module);
    expect(required.get("reactive-context")).toEqual(provide.span);
    expect(required.get("expose")).toEqual(find("const slots"));
    expect(required.get("model-array")).toEqual(model.span);
    expect(required.get("model-modifiers")).toEqual(model.span);
    form.render = createElement("li", [], [], find("<div>"));
    expect(requiredCapabilities(module).get("contextual-root")).toEqual(find("<div>"));
  });
});

describe("compositionUse", () => {
  it("finds where a component first uses composition, in source order", () => {
    const module = composition();
    const form = module.components[0]!;
    expect(compositionUse(module, form)).toEqual({
      what: "an injection key",
      span: module.keys![0]!.span,
    });
    delete module.keys;
    expect(compositionUse(module, form)).toEqual({
      what: "`defineSlots`",
      span: form.slots!.span,
    });
    delete form.slots;
    expect(compositionUse(module, form)).toEqual({
      what: "model",
      span: find('const open = defineModel<boolean>("open");'),
    });
  });

  it("finds `defineOptions`, which no capability covers", () => {
    const module = composition();
    const form = module.components[0]!;
    delete module.keys;
    delete form.slots;
    form.setup = [];
    form.bindings = form.bindings.filter(({ kind }) => kind === "prop");
    form.render = createElement("div", [], [], find("<div>"));
    expect(compositionUse(module, form)).toBeUndefined();
    form.inheritAttrs = false;
    expect(compositionUse(module, form)).toEqual({ what: "`defineOptions`", span: form.span });
  });

  it("finds nothing in a component without composition", () => {
    const module = everyKind();
    for (const each of module.components) expect(compositionUse(module, each)).toBeUndefined();
  });
});

describe("requiredCapabilities over a component's attributes, slots and `<component is>`", () => {
  const field = (module: UfModule) =>
    (module.components[0]!.render as ElementNode).children[1] as ComponentNode;

  it("derives fallthrough at a component's class and style, and expose at its ref", () => {
    const module = composition();
    const at = find("label={label}");
    field(module).attributes.push(
      createClassAttribute([createStaticClass("wide", at)], at),
      createStyleAttribute([createStaticStyle("color", "red", at)], at),
      createRefAttribute("text@0", at),
    );
    const required = requiredCapabilities(module);
    expect(required.get("fallthrough")).toEqual(at);
    expect(required.get("expose")).toEqual(at);
    expect(required.has("class-binding")).toBe(false);
    expect(required.has("style-binding")).toBe(false);
  });

  it("derives a scoped slot at a fill with a parameter and an outlet with props", () => {
    const module = composition();
    const [fill] = field(module).fills;
    const parameter = createParameter("props", fill!.span);
    field(module).fills = [createSlotFill("default", fill!.children, fill!.span, { parameter })];
    expect(requiredCapabilities(module).get("scoped-slot")).toEqual(fill!.span);
    const scoped = composition();
    field(scoped).fills = [];
    const outlet = (scoped.components[0]!.render as ElementNode).children[3] as SlotOutletNode;
    outlet.props = createExpression("label", find("label", 0, find("?? label").start));
    expect(requiredCapabilities(scoped).get("scoped-slot")).toEqual(outlet.span);
  });

  it("derives default-slot presence at a test of it and at its forward, with slot forwarding", () => {
    const module = composition();
    const presence = find("slots.title");
    const branch = ((module.components[0]!.render as ElementNode).children[0] as IfNode)
      .branches[0]!;
    branch.condition = createExpression("slots.title", presence, [
      createSlotReference("default", presence),
    ]);
    expect(requiredCapabilities(module).get("default-slot-presence")).toEqual(presence);
    const forwarded = composition();
    const [fill] = field(forwarded).fills;
    field(forwarded).fills = [createSlotFill("default", [], fill!.span, { forward: "default" })];
    const required = requiredCapabilities(forwarded);
    expect(required.get("slot-forwarding")).toEqual(fill!.span);
    expect(required.get("default-slot-presence")).toEqual(fill!.span);
  });

  it("derives dynamic-component, and an element's capabilities for tag candidates", () => {
    const module = composition();
    const at = find("</div>");
    const is = createExpression("label", find("label", 0, find("<Field").end));
    (module.components[0]!.render as ElementNode).children.push(
      createDynamicNode(
        is,
        [{ kind: "Tag", tag: "a" }],
        [createClassAttribute([createStaticClass("link", at)], at)],
        [],
        at,
      ),
    );
    const required = requiredCapabilities(module);
    expect(required.get("dynamic-component")).toEqual(at);
    expect(required.get("class-binding")).toEqual(at);
    expect(required.has("fallthrough")).toBe(false);
  });

  it("derives a contextual root outside composition, which compositionUse leaves alone", () => {
    const at = find("<div>");
    const item = createComponent("Item", createElement("li", [], [createText("One", at)], at), at);
    const module = createModule("Item.uf.tsx", [item]);
    expect(requiredCapabilities(module).get("contextual-root")).toEqual(at);
    expect(compositionUse(module, item)).toBeUndefined();
  });
});

describe("requiredCapabilities over styles (ADR-0063)", () => {
  const sheet = createStyleSheet("./Card.css", ".card { color: red }", at(1));
  const styles = { sheets: [sheet], scopeId: "0123abcd" };
  /**
   * A module importing `Child`, as the default or by name, from a module whose sheets do or do not
   * use `:slotted()`.
   */
  const parent = (
    render: ElementNode,
    options: { styled: boolean; slotted?: boolean; named?: boolean },
  ) => {
    const api: ModuleApi = {
      file: "./Child.uf.tsx",
      components: [
        {
          name: "Child",
          export: options.named ? "named" : "default",
          props: [],
          events: [],
          models: [],
          slots: [{ name: "default", optional: true }],
          exposes: [],
          inheritAttrs: true,
          root: "element",
          rootTag: "div",
          ...(options.slotted === undefined
            ? {}
            : { styles: { scopeId: "89abcdef", slotted: options.slotted } }),
        },
      ],
      keys: [],
    };
    const card = createComponent(
      "Card",
      render,
      at(0),
      [],
      undefined,
      [],
      [],
      [],
      undefined,
      options.styled ? { styles } : {},
    );
    const child = createModuleImport(
      "./Child.uf.tsx",
      "Child.uf.tsx",
      api,
      [createImportedName("Component", options.named ? "Child" : "default", "Child", at(2))],
      at(2),
    );
    return createModule("Card.uf.tsx", [card], [], [], [child]);
  };
  const fill = createSlotFill("default", [createText("Hi", at(31))], at(30));
  const withChild = () =>
    createElement("div", [], [createComponentNode("Child", [], [fill], at(20))], at(10));

  it("derives scoped-styles at a component's first stylesheet", () => {
    const module = parent(createElement("div", [], [], at(10)), { styled: true });
    const required = requiredCapabilities(module);
    expect(required.get("scoped-styles")).toEqual(sheet.span);
    expect(required.has("child-root-scope")).toBe(false);
  });

  // Any meeting of two sheets' rules of equal specificity involves a styled module, so the
  // cascade order is required wherever a module has a sheet, and nowhere else (ADR-0063).
  it("derives sheet-order with scoped-styles, at the first stylesheet of every module with one", () => {
    const styled = requiredCapabilities(
      parent(createElement("div", [], [], at(10)), { styled: true }),
    );
    expect(styled.get("sheet-order")).toEqual(sheet.span);
    // A styled child, or a fill of one, gives a module without a sheet of its own none.
    for (const options of [{ styled: false }, { styled: false, slotted: true }]) {
      expect(requiredCapabilities(parent(withChild(), options)).has("sheet-order")).toBe(false);
    }
  });

  it("derives child-root-scope at any child a styled component renders", () => {
    const required = requiredCapabilities(parent(withChild(), { styled: true }));
    expect(required.get("child-root-scope")).toEqual(at(20));
    expect(required.has("slotted-styles")).toBe(false);
    expect(
      requiredCapabilities(parent(withChild(), { styled: false })).has("child-root-scope"),
    ).toBe(false);
  });

  it("derives slotted-styles at what fills a child whose sheets use :slotted()", () => {
    const required = requiredCapabilities(parent(withChild(), { styled: false, slotted: true }));
    expect(required.get("slotted-styles")).toEqual(at(30));
    expect(required.has("scoped-styles")).toBe(false);
    expect(required.has("child-root-scope")).toBe(false);
    const plain = requiredCapabilities(parent(withChild(), { styled: true, slotted: false }));
    expect(plain.has("slotted-styles")).toBe(false);
  });

  it("reads the API of a child imported by name", () => {
    const named = { styled: false, slotted: true, named: true };
    expect(requiredCapabilities(parent(withChild(), named)).get("slotted-styles")).toEqual(at(30));
  });

  it("derives both at a `<component is>` of components", () => {
    const dynamic = createElement(
      "div",
      [],
      [
        createDynamicNode(
          createExpression("x", at(40)),
          [{ kind: "Component", component: "Child" }],
          [],
          [],
          at(20),
          [fill],
        ),
      ],
      at(10),
    );
    const required = requiredCapabilities(parent(dynamic, { styled: true, slotted: true }));
    expect(required.get("child-root-scope")).toEqual(at(20));
    expect(required.get("slotted-styles")).toEqual(at(30));
    const tags = createElement(
      "div",
      [],
      [
        createDynamicNode(
          createExpression("x", at(40)),
          [{ kind: "Tag", tag: "a" }],
          [],
          [],
          at(20),
        ),
      ],
      at(10),
    );
    expect(requiredCapabilities(parent(tags, { styled: true })).has("child-root-scope")).toBe(
      false,
    );
  });

  it("reads the sheets of a component that renders itself", () => {
    const self = (source: string) => {
      const card = createComponent(
        "Card",
        createElement("div", [], [createComponentNode("Card", [], [fill], at(20))], at(10)),
        at(0),
        [],
        undefined,
        [],
        [],
        [],
        undefined,
        {
          styles: { sheets: [createStyleSheet("./Card.css", source, at(1))], scopeId: "0123abcd" },
        },
      );
      return requiredCapabilities(createModule("Card.uf.tsx", [card]));
    };
    expect(self(":slotted(.label) { color: red }").get("slotted-styles")).toEqual(at(30));
    expect(self(".label { color: red }").has("slotted-styles")).toBe(false);
    expect(self(".label { color: red }").get("child-root-scope")).toEqual(at(20));
  });
});

describe("requiredCapabilities over generics and composables (ADR-0068, ADR-0069)", () => {
  it("derives each where it is first used, in source order", () => {
    const module = m5.modules();
    const list = module.components[0]!;
    expect([...requiredCapabilities(module)].slice(0, 4)).toEqual([
      ["generic-components", list.typeParameters![0]!.span],
      ["props", list.propsParameter!.span],
      ["composables", list.setup[0]!.span],
      ["composable-effect-order", list.setup[0]!.span],
    ]);
    expect(requiredCapabilities(module).get("generic-slot-props")).toEqual(
      list.slots!.slots[0]!.span,
    );
  });

  it("scans a composable's arguments for what their code needs", () => {
    const module = m5.modules();
    const item = module.components[0]!.setup[0]!;
    if (item.kind !== "Use") throw new Error("the fixture changed");
    const at = item.arguments[1]!.span;
    const call = { start: at.start, end: at.start + "nextTick".length };
    item.arguments[1] = {
      kind: "Callback",
      callback: {
        parameters: [],
        body: {
          code: "nextTick()",
          span: at,
          refs: [{ kind: "Api", api: "nextTick", span: call }],
        },
        span: at,
      },
      span: at,
    };
    expect(requiredCapabilities(module).get("next-tick")).toEqual(call);
  });

  it("requires `composable-effect-order` only of a composable that runs code in the browser", () => {
    const module = m5.modules();
    delete (module.components[0]!.setup[0] as { hasEffects?: true }).hasEffects;
    expect(requiredCapabilities(module).has("composables")).toBe(true);
    expect(requiredCapabilities(module).has("composable-effect-order")).toBe(false);
  });

  it("requires `generic-slot-props` of a slot that names a type parameter, or a fill of one", () => {
    const module = m5.modules();
    const list = module.components[0]!;
    list.slots!.slots[0]!.references = ["Item"];
    expect(requiredCapabilities(module).has("generic-slot-props")).toBe(false);
    const api: ComponentApi = {
      name: "List",
      export: "default",
      props: [],
      events: [],
      models: [],
      slots: [{ name: "item", optional: true, props: "{ item: T }", references: ["T"] }],
      exposes: [],
      inheritAttrs: true,
      root: "element",
      typeParameters: ["T"],
    };
    const fill = createSlotFill("item", [], at(20), {
      parameter: createParameter("props", at(21)),
    });
    const parent = (child: ComponentApi) =>
      requiredCapabilities(
        createModule(
          "Page.uf.tsx",
          [
            createComponent(
              "Page",
              createElement("div", [], [createComponentNode("List", [], [fill], at(10))], at(5)),
              at(0),
            ),
          ],
          [],
          [],
          [
            createModuleImport(
              "./List.uf.tsx",
              "List.uf.tsx",
              { file: "List.uf.tsx", components: [child], keys: [] },
              [createImportedName("Component", "default", "List", at(1))],
              at(1),
            ),
          ],
        ),
      );
    expect(parent(api).get("generic-slot-props")).toEqual(at(20));
    expect(parent({ ...api, typeParameters: undefined }).has("generic-slot-props")).toBe(false);
  });
});

describe("composableUse", () => {
  it("finds where a component first calls a composable or reads what a module gives", () => {
    const module = m5.modules();
    const list = module.components[0]!;
    expect(composableUse(list)).toEqual({
      what: "a value imported from a `.ts` module",
      span: list.bindings[0]!.span,
    });
    list.bindings = list.bindings.filter(({ kind }) => kind !== "import");
    expect(composableUse(list)).toEqual({
      what: "a module's constant",
      span: list.bindings[0]!.span,
    });
    list.bindings = list.bindings.filter(({ kind }) => kind !== "moduleConst");
    // The call starts before the names it destructures.
    expect(composableUse(list)).toEqual({ what: "a composable's call", span: list.setup[0]!.span });
    list.setup = [];
    expect(composableUse(list)).toEqual({
      what: "a composable's result",
      span: list.bindings.find(({ kind }) => kind === "usedState")!.span,
    });
    list.bindings = list.bindings.filter(({ kind }) => !kind.startsWith("used"));
    expect(composableUse(list)).toBeUndefined();
  });
});
