// The composition contract (ADR-0055): `walk` and the visitors over its kinds, and the
// invariants it adds, on the composition fixture.
import { describe, expect, it } from "vitest";

import {
  ATTRIBUTE_KINDS,
  BINDING_KINDS,
  checkInvariants,
  childrenOf,
  CODE_REFERENCE_KINDS,
  codeOf,
  collectFeatures,
  createBinding,
  createBindingReference,
  createCode,
  createDynamicNode,
  createExposes,
  createExpression,
  createFunctionHandler,
  createImportedName,
  createInterpolation,
  createModelAttribute,
  createParameter,
  createPropAttribute,
  createSlotFill,
  createSlotReference,
  createStaticAttribute,
  createText,
  expressionsOf,
  functionsOf,
  RENDER_NODE_KINDS,
  SETUP_ITEM_KINDS,
  span,
  spansOf,
  validateModule,
  walk,
} from "../src/index.ts";
import type {
  Attribute,
  ComponentAttribute,
  ComponentNode,
  DynamicCandidate,
  ElementNode,
  Expression,
  IfNode,
  InjectItem,
  InlineHandler,
  ListenerAttribute,
  ModelAttribute,
  ModelBindingAttribute,
  ModelItem,
  PropAttribute,
  ProvideItem,
  RenderNode,
  SlotFill,
  SlotOutletNode,
  UfModule,
  WriteReference,
} from "../src/index.ts";
import { composition, expression, find, ids, SOURCE } from "./composition-fixture.ts";

const form = (module: UfModule) => module.components[0]!;
const root = (module: UfModule) => form(module).render as ElementNode;
const fieldOf = (module: UfModule) => root(module).children[1] as ComponentNode;

describe("the composition fixture", () => {
  it("is valid IR that keeps the invariants", () => {
    const module = composition();
    expect(validateModule(module)).toEqual([]);
    expect(checkInvariants(module)).toEqual([]);
  });

  it("round-trips through JSON, every absent field left out", () => {
    const module = composition();
    expect(JSON.parse(JSON.stringify(module))).toEqual(module);
  });
});

describe("walk and the visitors over composition", () => {
  it("visits a component's fills, a slot outlet's fallback and a conditional's branches", () => {
    const kinds: string[] = [];
    walk(composition().components[0]!.render, { enter: (node) => void kinds.push(node.kind) });
    expect(kinds).toEqual([
      "Element",
      "If",
      "Element",
      "Interpolation",
      "Component",
      "Interpolation",
      "Element",
      "SlotOutlet",
      "Interpolation",
    ]);
  });

  it("gives a Dynamic node's children, then its fills' children", () => {
    const module = composition();
    const [interpolation] = fieldOf(module).fills[0]!.children;
    const dynamic = createDynamicNode(
      createExpression("x", span(0, 1)),
      [{ kind: "Component", component: "Field" }],
      [],
      [],
      span(0, 1),
      [createSlotFill("default", [interpolation!], span(0, 1))],
    );
    expect(childrenOf(dynamic)).toEqual([interpolation]);
  });

  it("collects every composition kind a module uses", () => {
    const features = collectFeatures(composition());
    expect([...features.nodeKinds]).toEqual(
      expect.arrayContaining(["Component", "SlotOutlet", "If", "Element", "Interpolation"]),
    );
    expect([...features.attributeKinds].toSorted()).toEqual([
      "Listener",
      "Model",
      "ModelBinding",
      "Prop",
    ]);
    expect([...features.bindingKinds].toSorted()).toEqual([
      "context",
      "model",
      "prop",
      "slots",
      "state",
    ]);
    expect([...features.setupItemKinds].toSorted()).toEqual([
      "Inject",
      "Model",
      "Provide",
      "State",
    ]);
    expect([...features.handlerKinds]).toEqual(["Inline"]);
    expect([...features.codeReferenceKinds].toSorted()).toEqual(["Binding", "Slot", "Write"]);
  });

  it("lists the new kinds in the coverage gate's records", () => {
    expect(RENDER_NODE_KINDS).toEqual(
      expect.arrayContaining(["Component", "SlotOutlet", "Dynamic"]),
    );
    expect(ATTRIBUTE_KINDS).toEqual(
      expect.arrayContaining(["Model", "Prop", "Listener", "ModelBinding"]),
    );
    expect(BINDING_KINDS).toEqual(
      expect.arrayContaining(["model", "slots", "slotScope", "context", "component"]),
    );
    expect(SETUP_ITEM_KINDS).toEqual(expect.arrayContaining(["Model", "Provide", "Inject"]));
    expect(CODE_REFERENCE_KINDS).toContain("Slot");
  });

  it("finds the expressions of props, models, fills and outlets, in document order", () => {
    const found = expressionsOf(form(composition())).map((located) => [
      located.expression.code,
      located.path,
    ]);
    expect(found).toEqual([
      ["slots.title", "/render/children/0/branches/0/condition"],
      ["theme", "/render/children/0/branches/0/children/0/children/0/value"],
      ["label", "/render/children/1/attributes/0/value"],
      ["text.value", "/render/children/1/attributes/1/value"],
      ["label", "/render/children/1/fills/0/children/0/value"],
      ["text.value", "/render/children/2/attributes/0/value"],
      ["label", "/render/children/3/fallback/0/value"],
    ]);
  });

  it("finds a component listener's handler, and a provided value as pure code", () => {
    const component = form(composition());
    expect(functionsOf(component).map(({ path, role }) => [path, role])).toEqual([
      ["/render/children/1/attributes/2/handler/function", "handler"],
    ]);
    expect(codeOf(component).map(({ code, context }) => [code.code, context])).toEqual([
      ['""', "pure"],
      ["label", "pure"],
      ["(open.value = false)", "client"],
    ]);
  });

  it("finds every span at its pointer, the imports', keys' and slots' included", () => {
    const module = composition();
    const pointers = spansOf(module).map(({ path }) => path);
    expect(pointers).toEqual(
      expect.arrayContaining([
        "/imports/0/span",
        "/imports/0/names/0/span",
        "/keys/0/span",
        "/keys/0/type/span",
        "/components/0/slots/span",
        "/components/0/slots/slots/1/span",
        "/components/0/render/children/1/fills/0/span",
        "/components/0/render/children/3/fallback/0/span",
        "/components/0/render/children/1/attributes/2/handler/span",
      ]),
    );
    for (const { span: at } of spansOf(module)) {
      expect(at.start).toBeLessThanOrEqual(at.end);
      expect(at.end).toBeLessThanOrEqual(SOURCE.length);
    }
  });
});

/** Asserts that the module breaks an invariant at a path ending in `path`, with `message`. */
function reports(module: UfModule, path: string, message: string): void {
  const errors = checkInvariants(module);
  expect(
    errors.some((error) => error.path.endsWith(path) && error.message.includes(message)),
    JSON.stringify(errors),
  ).toBe(true);
}

describe("checkInvariants on composition", () => {
  it("reports a component element that names no component in scope", () => {
    const module = composition();
    fieldOf(module).component = "Feld";
    reports(
      module,
      "/render/children/1/component",
      "must name exactly one imported or local component",
    );
  });

  it("reports a prop, a listener, a model and a fill the child does not declare", () => {
    const module = composition();
    const [prop, model, listener] = fieldOf(module).attributes as [
      PropAttribute,
      ModelBindingAttribute,
      ListenerAttribute,
    ];
    prop.name = "lable";
    model.model = "text";
    listener.event = "clean";
    fieldOf(module).fills[0]!.slot = "title";
    reports(module, "/attributes/0/name", 'must name a prop the component declares, and "lable"');
    reports(module, "/attributes/1/model", 'must name a model the component declares, and "text"');
    reports(
      module,
      "/attributes/2/event",
      'must name an event the component declares, and "clean"',
    );
    reports(module, "/fills/0/slot", 'must name a slot the component declares, and "title"');
  });

  it("reports a model bound to what is not a state's or a model's `.value`", () => {
    const module = composition();
    const input = root(module).children[2] as ElementNode;
    const [model] = input.attributes as [ModelAttribute];
    model.value = expression(find("label", 0, find("<Field").end), [["label", ids.label]]);
    reports(
      module,
      "/render/children/2/attributes/0/value",
      "must be a state's or a model's `.value`",
    );
  });

  it("reports a write of an injected value", () => {
    const module = composition();
    const listener = fieldOf(module).attributes[2] as ListenerAttribute;
    const handler = listener.handler as InlineHandler;
    (handler.function.body.refs[0] as WriteReference).binding = ids.theme;
    reports(module, "/refs/0/binding", "must name a state, a model or a setup `let`");
  });

  it("reports a slot outlet and a presence test of a slot the component does not declare", () => {
    const module = composition();
    (root(module).children[3] as { slot: string }).slot = "footer";
    reports(
      module,
      "/render/children/3/slot",
      'must name a slot the component declares, and "footer"',
    );
    const condition = (root(module).children[0] as { branches: { condition: Expression }[] })
      .branches[0]!.condition;
    (condition.refs[0] as { slot: string }).slot = "footer";
    reports(
      module,
      "/condition/refs/0/slot",
      'must name a slot the component declares, and "footer"',
    );
  });

  it("reports a slot's presence in setup code", () => {
    const module = composition();
    const provide = form(module).setup[3] as { value: { refs: unknown[] } };
    provide.value.refs = [createSlotReference("title", find("label", 0, find("provide(").start))];
    reports(module, "/setup/3/value/refs/0", "must not test a slot's presence");
  });

  it("reports a Dynamic node whose candidates mix tags and components", () => {
    const module = composition();
    root(module).children.push(
      createDynamicNode(
        createExpression("label", find("label", 0, find("<Field").end), [
          createBindingReference(ids.label, find("label", 0, find("<Field").end)),
        ]),
        [
          { kind: "Tag", tag: "a" },
          { kind: "Component", component: "Field" },
        ],
        [],
        [],
        find("</div>"),
      ),
    );
    reports(module, "/render/children/4/candidates", "must be all tags or all components");
  });

  it("reports an import whose name the module does not export", () => {
    const module = composition();
    module.imports![0]!.names[0]!.imported = "Missing";
    reports(
      module,
      "/imports/0/names/0/imported",
      'must name a component "./Field.uf.tsx" exports',
    );
  });
});

/** The fixture with a `Dynamic` node after the `<div>`'s children: `/render/children/4`. */
function withDynamic(
  candidates: DynamicCandidate[],
  attributes: (Attribute | ComponentAttribute)[] = [],
  children: RenderNode[] = [],
  fills?: SlotFill[],
): UfModule {
  const module = composition();
  const is = expression(find("label", 0, find("<Field").end), [["label", ids.label]]);
  root(module).children.push(
    createDynamicNode(is, candidates, attributes, children, find("</div>"), fills),
  );
  return module;
}

/** `label`, the prop, read in the `<Field>`'s `label={label}`. */
const labelRead = () => expression(find("label", 0, find("<Field").end), [["label", ids.label]]);

describe("checkInvariants on `<component is>`", () => {
  const at = "/render/children/4";

  it("reports a node with no candidate", () => {
    reports(withDynamic([]), `${at}/candidates`, "must hold a candidate");
  });

  it("reports a tag candidate that is no HTML element", () => {
    reports(
      withDynamic([{ kind: "Tag", tag: "foo" }]),
      `${at}/candidates/0/tag`,
      "must be an HTML element",
    );
  });

  it("reports fills and a component's attribute for tag candidates", () => {
    reports(
      withDynamic([{ kind: "Tag", tag: "a" }], [], [], []),
      `${at}/fills`,
      "must be absent for tag candidates",
    );
    reports(
      withDynamic(
        [{ kind: "Tag", tag: "a" }],
        [createPropAttribute("label", labelRead(), find("label={label}"))],
      ),
      `${at}/attributes/0`,
      "must be an element attribute for tag candidates",
    );
  });

  it("checks a tag candidate's attributes and children as its element's", () => {
    const model = createModelAttribute(labelRead(), "text", find("v-model={text.value}"));
    reports(
      withDynamic([{ kind: "Tag", tag: "input" }], [model]),
      `${at}/attributes/0/value`,
      "must be a state's or a model's `.value`",
    );
    const value = createStaticAttribute("href", "/", find("label={label}"));
    reports(
      withDynamic([{ kind: "Tag", tag: "input" }], [value]),
      `${at}/attributes/0/name`,
      "must be an attribute of <input>",
    );
    const text = createText("x", find("theme", 0, find("<h2>").start));
    reports(
      withDynamic([{ kind: "Tag", tag: "input" }], [], [text]),
      `${at}/children`,
      "is a void element",
    );
  });

  it("reports an element's attribute and children for component candidates", () => {
    const field: DynamicCandidate[] = [{ kind: "Component", component: "Field" }];
    reports(
      withDynamic(field, [createStaticAttribute("title", "x", find("label={label}"))]),
      `${at}/attributes/0`,
      "must be a component attribute for component candidates",
    );
    reports(
      withDynamic(field, [], [createText("x", find("theme", 0, find("<h2>").start))]),
      `${at}/children`,
      "must be empty for component candidates",
    );
  });
});

describe("checkInvariants on components, fills and slots", () => {
  it("reports an imported name that another component of the module takes", () => {
    const module = composition();
    module.imports![0]!.names[0]!.local = "Form";
    reports(module, "/imports/0/names/0/local", "must differ from every other component's name");
  });

  it("reports a prop set twice", () => {
    const module = composition();
    fieldOf(module).attributes.push(
      createPropAttribute("label", labelRead(), find("label={label}")),
    );
    reports(module, "/attributes/3/name", 'must set "label" once');
  });

  it("reports a listener whose handler is no local function, or takes a DOM event", () => {
    const module = composition();
    const listener = fieldOf(module).attributes[2] as ListenerAttribute;
    const handler = listener.handler;
    listener.handler = createFunctionHandler(ids.text, find("text", 0, find("<Field").start));
    reports(module, "/attributes/2/handler/binding", "must name a local function");
    const inline = handler as InlineHandler;
    inline.function.parameters = [
      createParameter("event", find("open", 0, find("onClear").start), { event: "MouseEvent" }),
    ];
    listener.handler = inline;
    reports(module, "/attributes/2/handler/function/parameters", "never a DOM event");
  });

  it("reports a slot filled twice", () => {
    const module = composition();
    const field = fieldOf(module);
    field.fills.push(createSlotFill("default", [], field.fills[0]!.span));
    reports(module, "/fills/1/slot", 'must fill "default" once');
  });

  it("reports a forward of a slot the component does not declare, and one with children", () => {
    const module = composition();
    const field = fieldOf(module);
    const [fill] = field.fills;
    field.fills = [createSlotFill("default", [], fill!.span, { forward: "footer" })];
    reports(module, "/fills/0/forward", 'must name a slot of the component, and "footer"');
    field.fills = [createSlotFill("default", fill!.children, fill!.span, { forward: "title" })];
    reports(module, "/render/children/1/fills/0", "must have no children or parameter");
  });

  it("reports a slot's presence that does not span `slots.<slot>`, and a read of `slots`", () => {
    const presence = find("slots.title");
    const short = span(presence.start, presence.start + 5);
    const condition = (module: UfModule) => (root(module).children[0] as IfNode).branches[0]!;
    const module = composition();
    condition(module).condition = createExpression("slots.title", presence, [
      createSlotReference("title", short),
    ]);
    reports(module, "/condition/refs/0/span", 'must span "slots.title"');
    const read = composition();
    condition(read).condition = createExpression("slots.title", presence, [
      createBindingReference(ids.slots, short),
    ]);
    reports(read, "/condition/refs/0/binding", "a slot is rendered, tested or forwarded");
  });

  it("reports a component binding read outside a template", () => {
    const module = composition();
    const where = find("label", 0, find("<Field").end);
    form(module).bindings.push(createBinding("label", "component", where));
    const provide = form(module).setup[3] as ProvideItem;
    const value = find("label", 0, find("provide(").start);
    provide.value = createCode("label", value, [
      createBindingReference(`label@${where.start}`, value),
    ]);
    reports(module, "/setup/3/value/refs/0/binding", "must not read the component");
  });

  it("reports a model's default that reads a binding", () => {
    const module = composition();
    const model = form(module).setup[1] as ModelItem;
    model.default = expression(find("label", 0, find("provide(").start), [["label", ids.label]]);
    reports(module, "/setup/1/default/refs", "a model's default is static");
  });
});

describe("checkInvariants on slots, exposes, keys and models", () => {
  it("reports a slot declared twice, and a slots binding the declaration does not declare", () => {
    const module = composition();
    const { slots } = form(module);
    slots!.slots[1]!.name = "default";
    reports(module, "/slots/slots/1/name", 'must declare "default" once');
    const other = composition();
    other.components[0]!.slots!.binding = ids.text;
    reports(other, "/slots/binding", "must name the slots binding the declaration declares");
    reports(other, "/bindings/1", "must be the binding `slots` declares");
  });

  it("reports an exposed name that is no local function", () => {
    const module = composition();
    form(module).exposes = createExposes([ids.text], find("const slots"));
    reports(module, "/exposes/functions/0", "must name a local function");
  });

  it("reports a key that the module neither declares nor imports, and an imported one it lacks", () => {
    const module = composition();
    (form(module).setup[3] as ProvideItem).key = "ColourKey";
    reports(
      module,
      "/setup/3/key",
      'must name an injection key the module declares or imports, and "ColourKey"',
    );
    const imported = composition();
    imported.imports![0]!.names.push(
      createImportedName("Key", "FieldKey", "FieldKey", find("Field")),
    );
    reports(
      imported,
      "/imports/0/names/1/imported",
      'must name an injection key "./Field.uf.tsx" exports',
    );
  });

  it("reports a model named as a prop, or twice", () => {
    const module = composition();
    (form(module).setup[1] as ModelItem).name = "label";
    reports(module, "/setup/1/name", 'must differ from every prop\'s name, and "label"');
    const twice = composition();
    const model = twice.components[0]!.setup[1] as ModelItem;
    twice.components[0]!.setup.splice(2, 0, {
      ...model,
      span: find("const theme = inject(ThemeKey);"),
    });
    reports(twice, "/setup/1/name", 'must declare the model "open" once');
  });

  it("reports a v-model control of another element", () => {
    const module = composition();
    const input = root(module).children[2] as ElementNode;
    (input.attributes[0] as ModelAttribute).control = "select";
    reports(module, "/render/children/2/attributes/0/control", "must be a control of <input>");
  });
});

describe("checkInvariants on what round 1 left untested", () => {
  it("reports a function exposed twice", () => {
    const module = composition();
    const at = find("label", 0, find("provide(").start);
    form(module).bindings.push(createBinding("save", "localFn", at));
    const save = `save@${at.start}`;
    form(module).exposes = createExposes([save, save], find("const slots"));
    reports(module, "/exposes/functions/1", `must expose "${save}" once`);
  });

  it("reports an inject of a key the module neither declares nor imports", () => {
    const module = composition();
    (form(module).setup[2] as InjectItem).key = "ColourKey";
    reports(
      module,
      "/setup/2/key",
      'must name an injection key the module declares or imports, and "ColourKey"',
    );
  });

  it("reports a `<component is>` candidate that names no component", () => {
    reports(
      withDynamic([{ kind: "Component", component: "Feld" }]),
      "/render/children/4/candidates/0/component",
      "must name exactly one imported or local component",
    );
  });

  it("keeps a scoped fill's names in scope in the fill alone", () => {
    // `item` is declared in the fill's parameter and read as text: inside the fill, then outside.
    const declared = find("text", 0, find("<Field").start);
    const read = find("open", 0, find("onClear").start);
    const item = `item@${declared.start}`;
    const scoped = () => {
      const module = composition();
      form(module).bindings.push(createBinding("item", "slotScope", declared));
      const [fill] = fieldOf(module).fills;
      fieldOf(module).fills = [
        createSlotFill("default", [], fill!.span, { parameter: createParameter("item", declared) }),
      ];
      return module;
    };
    const text = () =>
      createInterpolation(
        createExpression("item", read, [createBindingReference(item, read)]),
        read,
      );
    const inside = scoped();
    fieldOf(inside).fills[0]!.children = [text()];
    expect(checkInvariants(inside)).toEqual([]);
    const outside = scoped();
    (root(outside).children[3] as SlotOutletNode).fallback = [text()];
    reports(
      outside,
      "/render/children/3/fallback/0/value/refs/0/binding",
      "is a scoped fill's name outside its fill",
    );
  });
});

describe("checkInvariants on a key of a ref (ADR-0054)", () => {
  it("takes the ref itself, a state's by its name, where `provide` gives the key", () => {
    const module = composition();
    module.keys![0]!.type.code = "Ref<string>";
    module.keys![0]!.ref = "Ref";
    reports(
      module,
      "/setup/3/value",
      "must be a `state`, `derived` or `model` binding by its name",
    );
    const at = find("label", 0, find("provide(").start);
    (form(module).setup[3] as ProvideItem).value = createCode("text", at, [
      createBindingReference(ids.text, at),
    ]);
    expect(
      checkInvariants(module).filter((error) => error.path.startsWith("/components/0/setup/3")),
    ).toEqual([]);
  });
});
