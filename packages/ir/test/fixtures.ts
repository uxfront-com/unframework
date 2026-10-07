// IR the tests share: a module that uses every kind of node, attribute, class part, style
// declaration, reference, binding, setup item, handler and watch source, and keeps the
// invariants. Its spans index a source the tests never parse: what matters is that each
// expression's code fills its span and each reference spans the name it reads. The second
// component's spans are found in a source text written out below, so they stay consistent.
import {
  bindingId,
  createBinding,
  createBindingReference,
  createBoundAttribute,
  createBoundStyle,
  createBranch,
  createClassAttribute,
  createComponent,
  createDynamicClass,
  createElement,
  createExport,
  createExpression,
  createFor,
  createFragment,
  createGlobalReference,
  createIf,
  createInterpolation,
  createModule,
  createProp,
  createPropsParameter,
  createSpreadAttribute,
  createSpreadKey,
  createStaticAttribute,
  createStaticClass,
  createStaticStyle,
  createStyleAttribute,
  createText,
  createToggleClass,
  createTypeDeclaration,
  createTypeText,
  span,
  createApiReference,
  createCode,
  createConstItem,
  createDerivedItem,
  createEmitReference,
  createEmits,
  createEventAttribute,
  createEventControl,
  createEventDeclaration,
  createEventParameter,
  createEventReference,
  createFunctionCode,
  createFunctionHandler,
  createFunctionItem,
  createGetterSource,
  createIdItem,
  createInlineHandler,
  createLifecycleItem,
  createParameter,
  createParameterPattern,
  createRefAttribute,
  createRefSource,
  createStateItem,
  createTemplateRefItem,
  createVariableItem,
  createWatchEffectItem,
  createWatchItem,
  createWriteReference,
} from "../src/index.ts";
import type {
  BindingId,
  Code,
  CodeReference,
  Expression,
  Reference,
  Span,
  UfComponent,
  UfModule,
} from "../src/index.ts";

/**
 * An expression whose code starts at `start`, with a reference for each `[text, binding]`
 * (a global when the binding is left out), found by its text in the code: the `nth` occurrence.
 */
export function expression(
  code: string,
  start: number,
  refs: readonly (readonly [text: string, binding?: BindingId, nth?: number])[] = [],
): Expression {
  const references: Reference[] = refs.map(([text, binding, nth = 0]) => {
    let offset = -1;
    for (let found = 0; found <= nth; found++) offset = code.indexOf(text, offset + 1);
    if (offset === -1) throw new Error(`"${text}" is not in "${code}"`);
    const at = span(start + offset, start + offset + text.length);
    return binding === undefined
      ? createGlobalReference(text, at)
      : createBindingReference(binding, at);
  });
  return createExpression(code, span(start, start + code.length), references);
}

/** The props' bindings and the loop variables of {@link everyKind}. */
export const ids: Readonly<
  Record<"label" | "tone" | "items" | "attrs" | "item" | "index", BindingId>
> = {
  label: bindingId("label", 10),
  tone: bindingId("tone", 20),
  items: bindingId("items", 30),
  attrs: bindingId("attrs", 40),
  item: bindingId("item", 300),
  index: bindingId("index", 306),
};

/** A one-character span at `start`. */
const at = (start: number) => span(start, start + 1);

/** A module whose one component uses every kind of the IR, and keeps the invariants. */
export function everyKind(): UfModule {
  const declaration = "interface Attrs { id?: string }";
  const attrs = createTypeDeclaration("Attrs", true, declaration, span(0, declaration.length));
  const label = createProp(
    "label",
    false,
    createTypeText("string", span(110, 116)),
    at(10),
    ids.label,
  );
  const tone = createProp(
    "tone",
    true,
    createTypeText('"info" | "warn"', span(120, 135)),
    at(20),
    ids.tone,
    expression('"info"', 21),
  );
  const items = createProp(
    "items",
    false,
    createTypeText("string[]", span(140, 148)),
    at(30),
    ids.items,
  );
  const attrsProp = createProp(
    "attrs",
    true,
    createTypeText("Attrs", span(150, 155)),
    at(40),
    ids.attrs,
  );
  const card = createElement(
    "p",
    [
      createClassAttribute(
        [
          createStaticClass("card", at(200)),
          createToggleClass(
            "active",
            expression('tone === "warn"', 201, [["tone", ids.tone]]),
            at(201),
          ),
          createDynamicClass(expression("tone", 220, [["tone", ids.tone]]), at(220)),
        ],
        at(199),
      ),
      createStyleAttribute(
        [
          createStaticStyle("color", "red", at(230)),
          createBoundStyle("margin-top", expression("label", 240, [["label", ids.label]]), at(240)),
        ],
        at(229),
      ),
      createBoundAttribute(
        "title",
        expression("label.trim()", 250, [["label", ids.label]]),
        at(250),
      ),
      createSpreadAttribute(
        expression("attrs", 270, [["attrs", ids.attrs]]),
        [createSpreadKey("id", at(160))],
        true,
        at(269),
      ),
    ],
    [
      createText("Hello, ", at(280)),
      createInterpolation(
        expression("String(label)", 290, [["String"], ["label", ids.label]]),
        at(289),
      ),
    ],
    at(198),
  );
  const list = createIf(
    [
      createBranch(
        expression("items.length > 0", 320, [["items", ids.items]]),
        [
          createElement(
            "ul",
            [],
            [
              createFor(
                expression("items", 340, [["items", ids.items]]),
                ids.item,
                expression("index", 350, [["index", ids.index]]),
                createElement(
                  "li",
                  [],
                  [createInterpolation(expression("item", 360, [["item", ids.item]]), at(359))],
                  at(355),
                ),
                at(339),
                ids.index,
              ),
            ],
            at(330),
          ),
        ],
        at(319),
      ),
      createBranch(
        undefined,
        [createElement("p", [], [createText("None", at(380))], at(379))],
        at(378),
      ),
    ],
    at(318),
  );
  const icon = createElement(
    "svg",
    [createStaticAttribute("viewBox", "0 0 2 2", at(400))],
    [
      createElement("circle", [createStaticAttribute("r", "1", at(410))], [], at(409)),
      createElement("text", [], [createText(" ", at(420))], at(419)),
    ],
    at(399),
  );
  return createModule(
    "Card.uf.tsx",
    [
      createComponent(
        "Card",
        createFragment([card, list, icon], at(197)),
        span(100, 500),
        [label, tone, items, attrsProp],
        createPropsParameter("destructured", createTypeText("CardProps", span(105, 114)), at(101)),
        ["Attrs"],
        [
          createBinding("label", "prop", at(10)),
          createBinding("tone", "prop", at(20)),
          createBinding("items", "prop", at(30)),
          createBinding("attrs", "prop", at(40)),
          createBinding("item", "loopVar", at(300)),
          createBinding("index", "loopVar", at(306)),
        ],
      ),
      counter(),
    ],
    [
      createExport("default", "Card", span(100, 114)),
      createExport("named", "Counter", find("Counter")),
    ],
    [attrs],
  );
}

/** Where {@link COUNTER} starts in the module's source. */
const OFFSET = 1000;

/** The source of {@link everyKind}'s second component, which uses every kind of the setup. */
export const COUNTER: string = [
  "export function Counter({ start, items }: { start: number; items: string[] }) {",
  "  const emit = defineEmits<{ change: [value: number, previous?: number]; reset: [] }>();",
  "  const count = ref<number>(start);",
  "  const doubled = computed(() => count.value * 2);",
  "  const input = useTemplateRef<HTMLInputElement>();",
  "  const id = useId();",
  "  const step = 2;",
  "  let timer: number | undefined;",
  "  function increment(event: MouseEvent) {",
  "    event.preventDefault();",
  "    count.value += step;",
  '    emit("change", count.value, doubled.value);',
  "  }",
  '  const label = (value: number, [unit]: string[] = ["x"], suffix?: string, ...rest: string[]): string =>',
  '    String(value) + unit + (suffix ?? rest.join(""));',
  "  function select(entry: string) {",
  '    emit("change", entry.length);',
  "  }",
  "  watch(count, (value, previous, onCleanup) => {",
  '    emit("change", value, previous);',
  "    onCleanup(() => console.log(value));",
  "  }, { immediate: true });",
  '  watch([() => start, doubled], ([value]) => console.log(value), { flush: "post" });',
  "  watchEffect((onCleanup) => {",
  "    console.log(doubled.value);",
  "    onCleanup(() => console.log(step));",
  "  });",
  "  onMounted(async () => {",
  "    timer = setInterval(() => count.value++, 1000);",
  "    await nextTick();",
  "    input.value?.focus();",
  "  });",
  "  onUnmounted(() => clearInterval(timer));",
  "  return (",
  '    <div onWheelPassive={() => emit("reset")}>',
  "      <label for={id}>Count</label>",
  '      <input id={id} ref={input} onKeydown={(event) => { if (event.key === "Escape") event.preventDefault(); }} />',
  '      <button type="button" onClick={increment} onClickCapture={increment}>+{step}</button>',
  '      <button type="button" onClickOnce={() => (count.value = 0)}>Reset</button>',
  "      <output>{label(doubled.value)}</output>",
  '      <ul>{items.map((item) => <li key={item}><button type="button" onClick={() => select(item)}>{item}</button></li>)}</ul>',
  "    </div>",
  "  );",
  "}",
].join("\n");

/**
 * The span of the `nth` occurrence of `text` in {@link COUNTER} at or after `from`, an offset in
 * the module's source, as every span is.
 */
export function find(text: string, nth = 0, from: number = OFFSET): Span {
  let offset = from - OFFSET - 1;
  for (let found = 0; found <= nth; found++) offset = COUNTER.indexOf(text, offset + 1);
  if (offset === -1) throw new Error(`"${text}" is not in the counter's source`);
  return span(OFFSET + offset, OFFSET + offset + text.length);
}

/** The span of `name` in the first occurrence of `context`: a name where it is declared. */
export function nameIn(context: string, name: string): Span {
  const { start } = find(context);
  const offset = context.indexOf(name);
  return span(start + offset, start + offset + name.length);
}

/** A piece of the counter's source: its span, and the spans of the parts of it. */
export interface Piece {
  span: Span;
  /** The span of the `index`th occurrence of `part` in the piece. */
  at(part: string, index?: number): Span;
  /** The piece as code, with its references. */
  code(refs?: CodeReference[]): Code;
}

/** The `nth` occurrence of `text` in the counter's source, at or after `from`. */
export function piece(text: string, nth = 0, from: number = OFFSET): Piece {
  const where = find(text, nth, from);
  const locate = (part: string, index = 0): Span => {
    let offset = -1;
    for (let found = 0; found <= index; found++) offset = text.indexOf(part, offset + 1);
    if (offset === -1) throw new Error(`"${part}" is not in "${text}"`);
    return span(where.start + offset, where.start + offset + part.length);
  };
  return {
    span: where,
    at: locate,
    code: (refs: CodeReference[] = []): Code => createCode(text, where, refs),
  };
}

/** The bindings of {@link everyKind}'s second component, by name. */
export const counterIds: Readonly<
  Record<
    | "start"
    | "items"
    | "emit"
    | "count"
    | "doubled"
    | "input"
    | "id"
    | "step"
    | "timer"
    | "increment"
    | "label"
    | "select"
    | "item",
    BindingId
  >
> = {
  start: bindingId("start", nameIn("{ start, items }", "start").start),
  items: bindingId("items", nameIn("{ start, items }", "items").start),
  emit: bindingId("emit", nameIn("const emit", "emit").start),
  count: bindingId("count", nameIn("const count", "count").start),
  doubled: bindingId("doubled", nameIn("const doubled", "doubled").start),
  input: bindingId("input", nameIn("const input", "input").start),
  id: bindingId("id", nameIn("const id", "id").start),
  step: bindingId("step", nameIn("const step", "step").start),
  timer: bindingId("timer", nameIn("let timer", "timer").start),
  increment: bindingId("increment", nameIn("function increment", "increment").start),
  label: bindingId("label", nameIn("const label", "label").start),
  select: bindingId("select", nameIn("function select", "select").start),
  item: bindingId("item", nameIn("(item) =>", "item").start),
};

/** A reference to a binding of the counter: the `nth` occurrence of `text` in a piece. */
const ref = (located: Piece, text: string, binding: BindingId, nth = 0, call = false) =>
  createBindingReference(binding, located.at(text, nth), false, call);

/** A global read in a piece. */
const global = (located: Piece, name: string, nth = 0) =>
  createGlobalReference(name, located.at(name, nth));

/** A type annotation in the counter's source. */
const typeAt = (text: string, nth = 0, from = OFFSET) =>
  createTypeText(text, find(text, nth, from));

/** The counter: every kind of the setup, of listeners and of template refs. */
function counter(): UfComponent {
  const c = counterIds;
  const statement = (text: string) => find(text);
  // The props, destructured from an object type literal.
  const props = [
    createProp("start", false, typeAt("number"), find("start: number"), c.start),
    createProp("items", false, typeAt("string[]"), find("items: string[]"), c.items),
  ];
  const propsType = typeAt("{ start: number; items: string[] }");
  // defineEmits.
  const emitsType = piece("{ change: [value: number, previous?: number]; reset: [] }");
  const emits = createEmits(
    c.emit,
    createTypeText(emitsType.code().code, emitsType.span),
    [
      createEventDeclaration(
        "change",
        [
          createEventParameter("value", typeAt("number", 1), find("value: number")),
          createEventParameter("previous", typeAt("number", 2), find("previous?: number"), true),
        ],
        find("change: [value: number, previous?: number]"),
      ),
      createEventDeclaration("reset", [], find("reset: []")),
    ],
    statement(
      "const emit = defineEmits<{ change: [value: number, previous?: number]; reset: [] }>();",
    ),
  );
  // const count = ref<number>(start);
  const initial = piece("start", 1, find("ref<number>(").start);
  const state = createStateItem(
    c.count,
    statement("const count = ref<number>(start);"),
    initial.code([ref(initial, "start", c.start)]),
    typeAt("number", 3),
  );
  // const doubled = computed(() => count.value * 2);
  const getter = piece("count.value * 2");
  const derived = createDerivedItem(
    c.doubled,
    createFunctionCode(
      [],
      getter.code([ref(getter, "count.value", c.count)]),
      find("() => count.value * 2"),
      {
        expression: true,
      },
    ),
    statement("const doubled = computed(() => count.value * 2);"),
  );
  const templateRef = createTemplateRefItem(
    c.input,
    statement("const input = useTemplateRef<HTMLInputElement>();"),
    typeAt("HTMLInputElement"),
  );
  const id = createIdItem(c.id, statement("const id = useId();"));
  const two = piece("2", 0, find("const step = ").start);
  const constant = createConstItem(c.step, two.code(), statement("const step = 2;"));
  const variable = createVariableItem(
    c.timer,
    statement("let timer: number | undefined;"),
    undefined,
    typeAt("number | undefined"),
  );
  // function increment(event: MouseEvent) { … }
  const incrementBody = piece(
    '{\n    event.preventDefault();\n    count.value += step;\n    emit("change", count.value, doubled.value);\n  }',
  );
  const increment = createFunctionItem(
    c.increment,
    "declaration",
    createFunctionCode(
      [
        createParameter("event", find("event: MouseEvent"), {
          type: typeAt("MouseEvent"),
          event: "MouseEvent",
        }),
      ],
      incrementBody.code([
        createEventReference("preventDefault", incrementBody.at("event.preventDefault"), true),
        createWriteReference(
          c.count,
          "+=",
          incrementBody.at("count.value += step"),
          incrementBody.at("count.value"),
          incrementBody.at("step"),
        ),
        ref(incrementBody, "step", c.step),
        createEmitReference(
          c.emit,
          "change",
          incrementBody.at('emit("change", count.value, doubled.value)'),
          [incrementBody.at("count.value", 1), incrementBody.at("doubled.value")],
        ),
        ref(incrementBody, "count.value", c.count, 1),
        ref(incrementBody, "doubled.value", c.doubled),
      ]),
      span(find("(event: MouseEvent)").start, incrementBody.span.end),
      {
        eventControls: [
          createEventControl("preventDefault", incrementBody.at("event.preventDefault();")),
        ],
      },
    ),
    span(find("function increment").start, incrementBody.span.end),
  );
  // const label = (value, [unit] = ["x"], suffix?, ...rest): string => …;
  const labelBody = piece('String(value) + unit + (suffix ?? rest.join(""))');
  const labelStart = find("(value: number, [unit]").start;
  const label = createFunctionItem(
    c.label,
    "arrow",
    createFunctionCode(
      [
        createParameter("value", find("value: number", 0, labelStart), {
          type: typeAt("number", 0, labelStart),
        }),
        createParameter(
          createParameterPattern("[unit]", ["unit"], find("[unit]")),
          find('[unit]: string[] = ["x"]'),
          {
            type: typeAt("string[]", 0, labelStart),
            default: createExpression('["x"]', find('["x"]')),
          },
        ),
        createParameter("suffix", find("suffix?: string"), {
          type: typeAt("string", 0, find("suffix?: ").end),
          optional: true,
        }),
        createParameter("rest", find("...rest: string[]"), {
          type: typeAt("string[]", 0, find("...rest: ").end),
          rest: true,
        }),
      ],
      labelBody.code([global(labelBody, "String")]),
      span(labelStart, labelBody.span.end),
      { expression: true, returnType: typeAt("string", 0, find("): string =>").start) },
    ),
    span(find("const label").start, labelBody.span.end + 1),
  );
  // function select(entry: string) { emit("change", entry.length); }
  const selectBody = piece('{\n    emit("change", entry.length);\n  }');
  const select = createFunctionItem(
    c.select,
    "declaration",
    createFunctionCode(
      [
        createParameter("entry", find("entry: string"), {
          type: typeAt("string", 0, find("entry: ").end),
        }),
      ],
      selectBody.code([
        createEmitReference(c.emit, "change", selectBody.at('emit("change", entry.length)'), [
          selectBody.at("entry.length"),
        ]),
      ]),
      span(find("(entry: string)").start, selectBody.span.end),
    ),
    span(find("function select").start, selectBody.span.end),
  );
  // watch(count, (value, previous, onCleanup) => { … }, { immediate: true });
  const immediateBody = piece(
    '{\n    emit("change", value, previous);\n    onCleanup(() => console.log(value));\n  }',
  );
  const immediateStart = find("(value, previous, onCleanup)").start;
  const immediate = createWatchItem(
    [createRefSource(c.count, find("count", 0, find("watch(count").start + 6))],
    createFunctionCode(
      [
        createParameter("value", find("value", 0, immediateStart)),
        createParameter("previous", find("previous", 0, immediateStart)),
        createParameter("onCleanup", find("onCleanup", 0, immediateStart)),
      ],
      immediateBody.code([
        createEmitReference(c.emit, "change", immediateBody.at('emit("change", value, previous)'), [
          immediateBody.at("value"),
          immediateBody.at("previous"),
        ]),
        global(immediateBody, "console"),
      ]),
      span(immediateStart, immediateBody.span.end),
    ),
    span(find("watch(count").start, find("{ immediate: true });").end),
    { immediate: true },
  );
  // watch([() => start, doubled], ([value]) => console.log(value), { flush: "post" });
  const sourceGetter = piece("start", 0, find("watch([() => ").end);
  const postBody = piece("console.log(value)", 0, find("([value]) => ").start);
  const post = createWatchItem(
    [
      createGetterSource(
        createFunctionCode(
          [],
          sourceGetter.code([ref(sourceGetter, "start", c.start)]),
          find("() => start"),
          { expression: true },
        ),
        find("() => start"),
      ),
      createRefSource(c.doubled, find("doubled", 0, find("() => start, ").end - 1)),
    ],
    createFunctionCode(
      [
        createParameter(
          createParameterPattern("[value]", ["value"], find("[value]")),
          find("[value]"),
        ),
      ],
      postBody.code([global(postBody, "console")]),
      span(find("([value]) => ").start, postBody.span.end),
      { expression: true },
    ),
    find('watch([() => start, doubled], ([value]) => console.log(value), { flush: "post" });'),
    { array: true, post: true },
  );
  // watchEffect((onCleanup) => { … });
  const effectBody = piece(
    "{\n    console.log(doubled.value);\n    onCleanup(() => console.log(step));\n  }",
  );
  const effect = createWatchEffectItem(
    createFunctionCode(
      [createParameter("onCleanup", find("onCleanup", 0, find("watchEffect(").end))],
      effectBody.code([
        global(effectBody, "console"),
        ref(effectBody, "doubled.value", c.doubled),
        global(effectBody, "console", 1),
        ref(effectBody, "step", c.step),
      ]),
      span(find("(onCleanup) => {\n    console.log(doubled").start, effectBody.span.end),
    ),
    span(find("watchEffect(").start, effectBody.span.end + 3),
  );
  // onMounted(async () => { … });
  const mountedBody = piece(
    "{\n    timer = setInterval(() => count.value++, 1000);\n    await nextTick();\n    input.value?.focus();\n  }",
  );
  const mounted = createLifecycleItem(
    "mounted",
    createFunctionCode(
      [],
      mountedBody.code([
        createWriteReference(
          c.timer,
          "=",
          mountedBody.at("timer = setInterval(() => count.value++, 1000)"),
          mountedBody.at("timer"),
          mountedBody.at("setInterval(() => count.value++, 1000)"),
        ),
        global(mountedBody, "setInterval"),
        createWriteReference(
          c.count,
          "++",
          mountedBody.at("count.value++"),
          mountedBody.at("count.value"),
          undefined,
          true,
        ),
        createApiReference("nextTick", mountedBody.at("nextTick")),
        ref(mountedBody, "input.value", c.input),
      ]),
      span(find("async () => {").start, mountedBody.span.end),
      { async: true },
    ),
    span(find("onMounted(").start, mountedBody.span.end + 3),
  );
  const unmountedBody = piece("clearInterval(timer)");
  const unmounted = createLifecycleItem(
    "unmounted",
    createFunctionCode(
      [],
      unmountedBody.code([
        global(unmountedBody, "clearInterval"),
        ref(unmountedBody, "timer", c.timer),
      ]),
      find("() => clearInterval(timer)"),
      { expression: true },
    ),
    find("onUnmounted(() => clearInterval(timer));"),
  );
  return createComponent(
    "Counter",
    render(),
    span(OFFSET, OFFSET + COUNTER.length),
    props,
    createPropsParameter(
      "destructured",
      propsType,
      find("{ start, items }: { start: number; items: string[] }"),
    ),
    [],
    [
      createBinding("start", "prop", nameIn("{ start, items }", "start")),
      createBinding("items", "prop", nameIn("{ start, items }", "items")),
      createBinding("emit", "emit", nameIn("const emit", "emit")),
      createBinding("count", "state", nameIn("const count", "count")),
      createBinding("doubled", "derived", nameIn("const doubled", "doubled")),
      createBinding("input", "templateRef", nameIn("const input", "input")),
      createBinding("id", "localConst", nameIn("const id", "id")),
      createBinding("step", "localConst", nameIn("const step", "step")),
      createBinding("timer", "localVar", nameIn("let timer", "timer")),
      createBinding("increment", "localFn", nameIn("function increment", "increment")),
      createBinding("label", "localFn", nameIn("const label", "label")),
      createBinding("select", "localFn", nameIn("function select", "select")),
      createBinding("item", "loopVar", nameIn("(item) =>", "item")),
    ],
    [
      state,
      derived,
      templateRef,
      id,
      constant,
      variable,
      increment,
      label,
      select,
      immediate,
      post,
      effect,
      mounted,
      unmounted,
    ],
    emits,
  );
}

/** The counter's render tree: every kind of listener and a template ref. */
function render() {
  const c = counterIds;
  const between = (open: string, close: string, from = OFFSET) =>
    span(find(open, 0, from).start, find(close, 0, find(open, 0, from).start).end);
  // <div onWheelPassive={() => emit("reset")}>
  const wheel = piece('emit("reset")');
  const wheelListener = createEventAttribute(
    "wheel",
    createInlineHandler(
      createFunctionCode(
        [],
        wheel.code([createEmitReference(c.emit, "reset", wheel.span)]),
        find('() => emit("reset")'),
        { expression: true },
      ),
      find('() => emit("reset")'),
    ),
    find('onWheelPassive={() => emit("reset")}'),
    { passive: true },
  );
  // <label for={id}>Count</label>
  const labelFor = piece("id", 0, find("<label for={").end);
  const labelElement = createElement(
    "label",
    [
      createBoundAttribute(
        "for",
        createExpression("id", labelFor.span, [createBindingReference(c.id, labelFor.span)]),
        find("for={id}"),
      ),
    ],
    [createText("Count", find("Count", 0, find("<label").start))],
    between("<label", "</label>"),
  );
  // <input id={id} ref={input} onKeydown={(event) => { … }} />
  const inputId = piece("id", 0, find("<input id={").end);
  const keyBody = piece('{ if (event.key === "Escape") event.preventDefault(); }');
  const condition = piece('event.key === "Escape"');
  const keyListener = createEventAttribute(
    "keydown",
    createInlineHandler(
      createFunctionCode(
        [
          createParameter("event", find("event", 0, find("onKeydown={(").end), {
            event: "KeyboardEvent",
          }),
        ],
        keyBody.code([
          createEventReference("key", keyBody.at("event.key")),
          createEventReference("preventDefault", keyBody.at("event.preventDefault"), true),
        ]),
        span(find("(event) => {").start, keyBody.span.end),
        {
          eventControls: [
            createEventControl(
              "preventDefault",
              keyBody.at('if (event.key === "Escape") event.preventDefault();'),
              condition.code([createEventReference("key", condition.at("event.key"))]),
            ),
          ],
        },
      ),
      span(find("(event) => {").start, keyBody.span.end),
    ),
    span(find("onKeydown={").start, keyBody.span.end + 1),
  );
  const inputElement = createElement(
    "input",
    [
      createBoundAttribute(
        "id",
        createExpression("id", inputId.span, [createBindingReference(c.id, inputId.span)]),
        find("id={id}", 0, find("<input").start),
      ),
      createRefAttribute(c.input, find("ref={input}")),
      keyListener,
    ],
    [],
    between("<input", "/>"),
  );
  // <button type="button" onClick={increment} onClickCapture={increment}>+{step}</button>
  const firstButton = find('<button type="button" onClick={increment}').start;
  const stepRead = piece("step", 0, find("+{").end);
  const incrementButton = createElement(
    "button",
    [
      createStaticAttribute("type", "button", find('type="button"', 0, firstButton)),
      createEventAttribute(
        "click",
        createFunctionHandler(
          c.increment,
          find("increment", 0, find("onClick={", 0, firstButton).end),
        ),
        find("onClick={increment}"),
      ),
      createEventAttribute(
        "click",
        createFunctionHandler(c.increment, find("increment", 0, find("onClickCapture={").end)),
        find("onClickCapture={increment}"),
        { capture: true },
      ),
    ],
    [
      createText("+", find("+", 0, find("onClickCapture={increment}>").end - 1)),
      createInterpolation(
        createExpression("step", stepRead.span, [createBindingReference(c.step, stepRead.span)]),
        find("{step}"),
      ),
    ],
    between('<button type="button" onClick={increment}', "</button>"),
  );
  // <button type="button" onClickOnce={() => (count.value = 0)}>Reset</button>
  const resetBody = piece("(count.value = 0)");
  const resetButton = createElement(
    "button",
    [
      createStaticAttribute(
        "type",
        "button",
        find('type="button"', 0, find("onClickOnce").start - 30),
      ),
      createEventAttribute(
        "click",
        createInlineHandler(
          createFunctionCode(
            [],
            resetBody.code([
              createWriteReference(
                c.count,
                "=",
                resetBody.span,
                resetBody.at("count.value"),
                resetBody.at("0"),
                true,
              ),
            ]),
            find("() => (count.value = 0)"),
            { expression: true },
          ),
          find("() => (count.value = 0)"),
        ),
        find("onClickOnce={() => (count.value = 0)}"),
        { once: true },
      ),
    ],
    [createText("Reset", find("Reset"))],
    between('<button type="button" onClickOnce', "</button>"),
  );
  // <output>{label(doubled.value)}</output>
  const shown = piece("label(doubled.value)");
  const outputElement = createElement(
    "output",
    [],
    [
      createInterpolation(
        createExpression(shown.code().code, shown.span, [
          createBindingReference(c.label, shown.at("label"), false, true),
          createBindingReference(c.doubled, shown.at("doubled.value")),
        ]),
        find("{label(doubled.value)}"),
      ),
    ],
    between("<output>", "</output>"),
  );
  // <ul>{items.map((item) => <li key={item}><button … onClick={() => select(item)}>{item}</button></li>)}</ul>
  const listStart = find("<ul>").start;
  const source = piece("items", 0, listStart);
  const key = piece("item", 0, find("key={").end);
  const pick = piece("select(item)");
  const shownItem = piece("item", 0, find("}>{").end);
  const list = createFor(
    createExpression("items", source.span, [createBindingReference(c.items, source.span)]),
    c.item,
    createExpression("item", key.span, [createBindingReference(c.item, key.span)]),
    createElement(
      "li",
      [],
      [
        createElement(
          "button",
          [
            createStaticAttribute("type", "button", find('type="button"', 0, listStart)),
            createEventAttribute(
              "click",
              createInlineHandler(
                createFunctionCode(
                  [],
                  pick.code([
                    createBindingReference(c.select, pick.at("select"), false, true),
                    createBindingReference(c.item, pick.at("item")),
                  ]),
                  find("() => select(item)"),
                  { expression: true },
                ),
                find("() => select(item)"),
              ),
              find("onClick={() => select(item)}"),
            ),
          ],
          [
            createInterpolation(
              createExpression("item", shownItem.span, [
                createBindingReference(c.item, shownItem.span),
              ]),
              find("{item}", 0, listStart),
            ),
          ],
          between('<button type="button" onClick={() => select', "</button>"),
        ),
      ],
      between("<li", "</li>"),
    ),
    find(
      'items.map((item) => <li key={item}><button type="button" onClick={() => select(item)}>{item}</button></li>)',
    ),
  );
  return createElement(
    "div",
    [wheelListener],
    [
      labelElement,
      inputElement,
      incrementButton,
      resetButton,
      outputElement,
      createElement("ul", [], [list], between("<ul>", "</ul>")),
    ],
    between("<div onWheelPassive", "    </div>"),
  );
}
