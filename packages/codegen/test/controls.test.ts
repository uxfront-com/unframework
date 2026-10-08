import { analyze } from "@unframework/analyzer";
// Where a handler's event controls run (src/controls.ts, ADR-0047), on hand-built IR: a control a
// handler reaches through a call runs as the event is dispatched only when the call is at the top
// of the handler, and `requiredCapabilities` derives `conditional-event-control` where it is not.
import {
  createBinding,
  createCode,
  createComponent,
  createElement,
  createEventAttribute,
  createEventControl,
  createFunctionCode,
  createFunctionHandler,
  createFunctionItem,
  createInlineHandler,
  createModule,
  createParameter,
  createStateItem,
  span,
} from "@unframework/ir";
import type {
  Binding,
  Code,
  ElementNode,
  EventAttribute,
  FunctionCode,
  Span,
  UfComponent,
} from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { describe, expect, it } from "vitest";

import {
  eventCalls,
  handedControls,
  handlerControls,
  ownControls,
  requiredCapabilities,
} from "../src/index.ts";
import { codeAt } from "./expressions.ts";

const open = createBinding("open", "state", span(10, 14));
const query = createBinding("query", "state", span(20, 25));
const clear = createBinding("clear", "localFn", span(30, 35));
const close = createBinding("close", "localFn", span(40, 45));
const save = createBinding("save", "localFn", span(50, 54));

const event = (offset: number) =>
  createParameter("event", span(offset, offset + 5), { event: "KeyboardEvent" });

/** `function <name>(event: KeyboardEvent) { event.preventDefault(); … }`, its body at `offset`. */
function preventing(binding: Binding, offset: number): FunctionCode {
  const text = `{\n  event.preventDefault();\n  ${binding === clear ? "query" : "open"}.value = "";\n}`;
  const body = codeAt(offset, text, {
    member: "preventDefault",
    text: "event.preventDefault",
    call: true,
  });
  const statement = text.indexOf("event.preventDefault();");
  return createFunctionCode([event(offset - 20)], body, span(offset - 20, offset + text.length), {
    eventControls: [
      createEventControl(
        "preventDefault",
        span(offset + statement, offset + statement + "event.preventDefault();".length),
      ),
    ],
  });
}

/** An inline handler `(event) => …` with a block body at `offset`. */
function handler(offset: number, body: Code, options: { expression?: boolean } = {}) {
  return createFunctionCode(
    [event(offset - 12)],
    body,
    span(offset - 12, offset + body.code.length),
    options,
  );
}

const setup = [
  createStateItem(open.id, open.span, createCode("false", span(15, 20))),
  createStateItem(query.id, query.span, createCode('""', span(26, 28))),
  createFunctionItem(clear.id, "declaration", preventing(clear, 1000), clear.span),
  createFunctionItem(close.id, "declaration", preventing(close, 1100), close.span),
  createFunctionItem(
    save.id,
    "declaration",
    createFunctionCode([], createCode("{}", span(1200, 1202)), span(1199, 1202), { async: true }),
    save.span,
  ),
];

function component(listeners: EventAttribute[]): UfComponent {
  return createComponent(
    "Search",
    createElement("input", listeners, [], span(500, 501)),
    span(0, 2000),
    [],
    undefined,
    [],
    [open, query, clear, close, save],
    setup,
  );
}

const escape = handler(
  2000,
  codeAt(
    2000,
    '{\n  if (event.key === "Escape") clear(event);\n}',
    { member: "key", text: "event.key" },
    { call: "clear", binding: clear },
  ),
);
const whenOpen = handler(
  2100,
  codeAt(2100, "{\n  if (open.value) close(event);\n}", ["open.value", open], {
    call: "close",
    binding: close,
  }),
);
const direct = handler(2200, codeAt(2200, "clear(event)", { call: "clear", binding: clear }), {
  expression: true,
});
const afterAwait = handler(
  2300,
  codeAt(
    2300,
    "{\n  await save();\n  clear(event);\n}",
    { call: "save", binding: save },
    { call: "clear", binding: clear },
  ),
);

// `{ if (event.key !== "Escape") return; clear(event); }`: a guard clause on the event.
const guarded = handler(
  2400,
  codeAt(
    2400,
    '{\n  if (event.key !== "Escape") return;\n  if (event.repeat) {\n    return;\n  }\n  clear(event);\n}',
    { member: "key", text: "event.key" },
    { member: "repeat", text: "event.repeat" },
    { call: "clear", binding: clear },
  ),
);
// A guard clause on state, then another statement that may leave the body.
const whenClosed = handler(
  2500,
  codeAt(2500, "{\n  if (!open.value) return;\n  clear(event);\n}", ["open.value", open], {
    call: "clear",
    binding: clear,
  }),
);
const switched = handler(
  2600,
  codeAt(
    2600,
    '{\n  switch (event.key) {\n    case "Tab":\n      return;\n  }\n  clear(event);\n}',
    { member: "key", text: "event.key" },
    { call: "clear", binding: clear },
  ),
);
// A test that casts the event's target reads only the event: a type is no read.
const cast = handler(
  2700,
  codeAt(
    2700,
    '{\n  if ((event.target as HTMLInputElement).value !== "") clear(event);\n}',
    { member: "target", text: "event.target" },
    { call: "clear", binding: clear },
  ),
);
// Other statements before the call: a `switch`, a callback.
const plain = handler(
  2800,
  codeAt(
    2800,
    '{\n  switch (event.key) {\n    case "a":\n      break;\n  }\n  [1].forEach((n) => {\n    if (n) return;\n  });\n  clear(event);\n}',
    { member: "key", text: "event.key" },
    { call: "clear", binding: clear },
  ),
);

/** `function close(event) { if (event.key !== "Escape") return; event.preventDefault(); }`. */
function guardedControl(offset: number): FunctionCode {
  const text = '{\n  if (event.key !== "Escape") return;\n  event.preventDefault();\n}';
  const body = codeAt(
    offset,
    text,
    { member: "key", text: "event.key" },
    { member: "preventDefault", text: "event.preventDefault", call: true },
  );
  const statement = text.indexOf("event.preventDefault();");
  return createFunctionCode([event(offset - 20)], body, span(offset - 20, offset + text.length), {
    eventControls: [
      createEventControl(
        "preventDefault",
        span(offset + statement, offset + statement + "event.preventDefault();".length),
      ),
    ],
  });
}

describe("eventCalls", () => {
  const takesEvent = (binding: string) => binding === clear.id || binding === close.id;

  it("finds a call under an `if` that tests only the event, with its test", () => {
    const [call] = eventCalls(escape, takesEvent);
    expect(call).toMatchObject({ binding: clear.id, dispatched: true });
    expect(call?.tests?.map(({ test, negated }) => [test.code, negated])).toEqual([
      ['event.key === "Escape"', undefined],
    ]);
    expect(call?.tests?.[0]?.test.refs).toEqual([escape.body.refs[0]]);
  });

  it("finds an arrow's call as its body dispatched on every event", () => {
    expect(eventCalls(direct, takesEvent)).toEqual([
      { binding: clear.id, span: direct.body.refs[0]!.span, dispatched: true },
    ]);
  });

  it("finds a call under a test of state, or after an `await`, not dispatched", () => {
    expect(eventCalls(whenOpen, takesEvent).map((call) => call.dispatched)).toEqual([false]);
    expect(eventCalls(afterAwait, takesEvent).map((call) => call.dispatched)).toEqual([false]);
  });

  it("finds a call after guard clauses that test only the event, with their tests negated", () => {
    const [call] = eventCalls(guarded, takesEvent);
    expect(call).toMatchObject({ binding: clear.id, dispatched: true });
    expect(call?.tests?.map(({ test, negated }) => [test.code, negated])).toEqual([
      ['event.key !== "Escape"', true],
      ["event.repeat", true],
    ]);
    expect(call?.tests?.map(({ test }) => test.refs)).toEqual([
      [guarded.body.refs[0]],
      [guarded.body.refs[1]],
    ]);
  });

  it("finds a call after a guard clause on state, or another statement that may leave, not dispatched", () => {
    expect(eventCalls(whenClosed, takesEvent).map((call) => call.dispatched)).toEqual([false]);
    expect(eventCalls(switched, takesEvent).map((call) => call.dispatched)).toEqual([false]);
  });

  it("finds a call after other statements not dispatched, and one under a cast test dispatched", () => {
    expect(eventCalls(plain, takesEvent)).toEqual([
      { binding: clear.id, span: plain.body.refs[1]!.span, dispatched: false },
    ]);
    const [call] = eventCalls(cast, takesEvent);
    expect(call).toMatchObject({ dispatched: true });
    expect(call?.tests?.[0]?.test.code).toBe('(event.target as HTMLInputElement).value !== ""');
  });
});

describe("handlerControls", () => {
  it("lifts a callee's control through a dispatched call, with the call's test", () => {
    const { controls, unliftable } = handlerControls(escape, component([]));
    expect(unliftable).toEqual([]);
    expect(controls).toHaveLength(1);
    expect(controls[0]!.control.method).toBe("preventDefault");
    expect(controls[0]!.tests.map(({ test }) => test.code)).toEqual(['event.key === "Escape"']);
    expect(handlerControls(direct, component([])).controls[0]!.tests).toEqual([]);
  });

  it("lifts a control after guard clauses on the event with their tests negated, the call's first", () => {
    const lifted = handlerControls(guarded, component([])).controls;
    expect(lifted).toHaveLength(1);
    expect(lifted[0]!.tests.map(({ fn, test, negated }) => [fn, test.code, negated])).toEqual([
      [guarded, 'event.key !== "Escape"', true],
      [guarded, "event.repeat", true],
    ]);
    // The callee's own guard clause comes after the call's tests, with the callee's function.
    const own = guardedControl(3000);
    const callee = createBinding("dismiss", "localFn", span(60, 67));
    const caller = handler(
      3100,
      codeAt(
        3100,
        '{\n  if (event.repeat) return;\n  if (event.key !== "Enter") dismiss(event);\n}',
        { member: "repeat", text: "event.repeat" },
        { member: "key", text: "event.key" },
        { call: "dismiss", binding: callee },
      ),
    );
    const withCallee = createComponent(
      "Search",
      createElement("input", [], [], span(500, 501)),
      span(0, 4000),
      [],
      undefined,
      [],
      [open, query, clear, close, save, callee],
      [...setup, createFunctionItem(callee.id, "declaration", own, callee.span)],
    );
    const [through] = handlerControls(caller, withCallee).controls;
    expect(through?.tests.map(({ fn, test, negated }) => [fn, test.code, negated])).toEqual([
      [caller, "event.repeat", true],
      [caller, 'event.key !== "Enter"', undefined],
      [own, 'event.key !== "Escape"', true],
    ]);
    expect(
      handlerControls(own, withCallee).controls[0]!.tests.map(({ fn, test, negated }) => [
        fn,
        test.code,
        negated,
      ]),
    ).toEqual([[own, 'event.key !== "Escape"', true]]);
  });

  it("reports the call through which a control cannot run as the event is dispatched", () => {
    expect(handlerControls(whenOpen, component([]))).toEqual({
      controls: [],
      unliftable: [whenOpen.body.refs[1]!.span],
    });
  });
});

describe("conditional-event-control", () => {
  const listener = (fn: FunctionCode, at: number, options = {}) =>
    createEventAttribute(
      "keydown",
      createInlineHandler(fn, span(at, at + 1)),
      span(at, at + 1),
      options,
    );
  const derived = (listeners: EventAttribute[]) =>
    requiredCapabilities(createModule("Search.uf.tsx", [component(listeners)])).get(
      "conditional-event-control",
    );

  it("is not used where every control runs as the event is dispatched", () => {
    expect(derived([listener(escape, 600), listener(direct, 610)])).toBeUndefined();
    // A `once` listener whose control is unconditional.
    expect(
      derived([
        createEventAttribute(
          "keydown",
          createFunctionHandler(clear.id, span(620, 621)),
          span(620, 621),
          {
            once: true,
          },
        ),
      ]),
    ).toBeUndefined();
  });

  it("is used at a call under a test of state, and at one after an `await`", () => {
    expect(derived([listener(escape, 600), listener(whenOpen, 610)])).toEqual(
      whenOpen.body.refs[1]!.span,
    );
    expect(derived([listener(afterAwait, 620)])).toEqual(afterAwait.body.refs[1]!.span);
  });

  it("is used at a call after a guard clause on state or another statement, not after one on the event", () => {
    expect(derived([listener(guarded, 600)])).toBeUndefined();
    expect(derived([listener(plain, 605)])).toEqual(plain.body.refs[1]!.span);
    expect(derived([listener(whenClosed, 610)])).toEqual(whenClosed.body.refs[1]!.span);
    expect(derived([listener(switched, 620)])).toEqual(switched.body.refs[1]!.span);
  });

  it("is used at a `once` listener whose control runs after a guard clause", () => {
    expect(derived([listener(guarded, 630, { once: true })])).toEqual(span(630, 631));
  });

  it("is used at a `once` listener whose control runs under a condition", () => {
    expect(derived([listener(escape, 630, { once: true })])).toEqual(span(630, 631));
  });

  it("is used at a `once` listener with a control on an element listening in both phases", () => {
    const once = createEventAttribute(
      "keydown",
      createFunctionHandler(clear.id, span(640, 641)),
      span(640, 641),
      { once: true },
    );
    const capture = listener(direct, 650, { capture: true });
    expect(derived([once, capture])).toEqual(span(640, 641));
  });

  it("is used at a capture listener's control where an element listens in both phases", () => {
    expect(derived([listener(direct, 650, { capture: true })])).toBeUndefined();
    expect(derived([listener(direct, 650, { capture: true }), listener(escape, 660)])).toEqual(
      span(650, 651),
    );
  });
});

describe("on an analysed source", () => {
  // The analyser's `eventControlsOf` and `eventCalls` judge statements by one rule: a guard
  // clause on the event before a control or a call is its negated test, any other statement that
  // may leave the body stops it running as the event is dispatched (UF3033 for an own control).
  const source = [
    'import { ref } from "unframework";',
    "export default function Keys() {",
    "  const open = ref(true);",
    '  function close(event: KeyboardEvent) { if (event.key !== "Escape") return; event.preventDefault(); open.value = false; }',
    "  function onKey(event: KeyboardEvent) { if (!open.value) return; close(event); }",
    "  return (",
    "    <div>",
    '      <input aria-label="Own" onKeydown={close} />',
    '      <input aria-label="Call" onKeydown={(event) => { if (event.repeat) return; close(event); }} />',
    '      <input aria-label="State" onKeydown={onKey} />',
    "    </div>",
    "  );",
    "}",
  ].join("\n");
  const { module, diagnostics } = analyze(parseModule("Keys.uf.tsx", source));
  const keys = module!.components[0]!;
  const listeners = (keys.render as ElementNode).children.flatMap((child) =>
    child.kind === "Element" ? child.attributes.filter((each) => each.kind === "Event") : [],
  ) as EventAttribute[];
  const fnOf = (listener: EventAttribute): FunctionCode =>
    listener.handler.kind === "Inline"
      ? listener.handler.function
      : (
          keys.setup.find(
            (item) =>
              item.kind === "Function" &&
              item.binding === (listener.handler as { binding: string }).binding,
          ) as { function: FunctionCode }
        ).function;
  const tests = (listener: EventAttribute) =>
    handlerControls(fnOf(listener), keys).controls.map((lifted) =>
      lifted.tests.map(({ test, negated }) => `${negated ? "!" : ""}(${test.code})`).join(" && "),
    );

  it("lifts the controls a guard clause on the event leaves dispatched, under its negated test", () => {
    expect(diagnostics).toEqual([]);
    expect(tests(listeners[0]!)).toEqual(['!(event.key !== "Escape")']);
    expect(tests(listeners[1]!)).toEqual(['!(event.repeat) && !(event.key !== "Escape")']);
  });

  it("derives `conditional-event-control` at a call after a guard clause on state", () => {
    const at = source.indexOf("close(event); }\n  return");
    expect(handlerControls(fnOf(listeners[2]!), keys).unliftable).toEqual([span(at, at + 5)]);
    expect(requiredCapabilities(module!).get("conditional-event-control")).toEqual(
      span(at, at + 5),
    );
  });
});

/** An analysed source's first component, with its listeners and functions by name. */
function analysed(name: string, lines: string[]) {
  const source = lines.join("\n");
  const { module, diagnostics } = analyze(parseModule(`${name}.uf.tsx`, source));
  const found = module!.components[0]!;
  const listeners: EventAttribute[] = [];
  const visit = (node: { kind: string }) => {
    if (node.kind !== "Element") return;
    const element = node as ElementNode;
    for (const attribute of element.attributes) {
      if (attribute.kind === "Event") listeners.push(attribute);
    }
    for (const child of element.children) visit(child);
  };
  visit(found.render);
  const named = (binding: string) =>
    (
      found.setup.find(
        (item) =>
          item.kind === "Function" &&
          found.bindings.find((each) => each.id === item.binding)?.name === binding,
      ) as { function: FunctionCode }
    ).function;
  const fnOf = (listener: EventAttribute): FunctionCode =>
    listener.handler.kind === "Inline"
      ? listener.handler.function
      : (
          found.setup.find(
            (item) =>
              item.kind === "Function" &&
              item.binding === (listener.handler as { binding: string }).binding,
          ) as { function: FunctionCode }
        ).function;
  const text = (each: Span) => source.slice(each.start, each.end);
  /** A listener's lifted controls as `method if condition & tests`, and its unliftable spans. */
  const lifted = (index: number) => {
    const { controls, unliftable } = handlerControls(fnOf(listeners[index]!), found);
    return {
      controls: controls.map(
        ({ control, tests }) =>
          `${control.method}${control.condition ? ` if ${control.condition.code}` : ""}${tests
            .map(({ test, negated }) => ` & ${negated ? "!" : ""}(${test.code})`)
            .join("")}`,
      ),
      unliftable: unliftable.map(text),
    };
  };
  return { source, module: module!, diagnostics, component: found, listeners, named, lifted, text };
}

describe("the top of a handler (ADR-0047)", () => {
  const keys = analysed("Keys", [
    'import { defineEmits, ref } from "unframework";',
    "export default function Keys() {",
    "  const emit = defineEmits<{ navigate: []; saved: [] }>();",
    "  const count = ref(0);",
    "  const saving = ref(false);",
    "  function save(event: SubmitEvent) { event.preventDefault(); saving.value = true; }",
    "  function dismiss(event: MouseEvent) { event.stopPropagation(); count.value = 0; }",
    "  function close() { count.value = -1; }",
    "  function cancel(event: KeyboardEvent) { event.stopPropagation(); if (event.defaultPrevented) return; count.value += 1; }",
    "  return (",
    "    <div>",
    '      <a href="#a" onClick={(event) => { if (event.defaultPrevented || event.button !== 0) return; event.preventDefault(); emit("navigate"); }}>A</a>',
    '      <a href="#b" onClick={(event) => { count.value += 1; event.preventDefault(); }}>B</a>',
    '      <form aria-label="F" onSubmit={(event) => void save(event)}><button type="submit">Go</button></form>',
    '      <form aria-label="G" onSubmit={(event) => { void save(event); }}><button type="submit">Go</button></form>',
    '      <form aria-label="H" onSubmit={(event) => event.submitter !== null && save(event)}><button type="submit">Go</button></form>',
    '      <button type="button" onClick={(event) => (event.altKey ? dismiss(event) : close())}>X</button>',
    '      <input aria-label="K" onKeydown={(event) => { cancel(event); event.preventDefault(); }} />',
    "    </div>",
    "  );",
    "}",
  ]);

  it("compiles the sources", () => {
    expect(keys.diagnostics).toEqual([]);
  });

  it("keeps a control after a guard that reads defaultPrevented, or after another statement, in place", () => {
    expect(keys.lifted(0)).toEqual({ controls: [], unliftable: ["event.preventDefault()"] });
    expect(keys.lifted(1)).toEqual({ controls: [], unliftable: ["event.preventDefault()"] });
  });

  it("reads a call through `void`, `&&` and `?:`, under their tests", () => {
    expect(keys.lifted(2)).toEqual({ controls: ["preventDefault"], unliftable: [] });
    expect(keys.lifted(3)).toEqual({ controls: ["preventDefault"], unliftable: [] });
    expect(keys.lifted(4)).toEqual({
      controls: ["preventDefault & (event.submitter !== null)"],
      unliftable: [],
    });
    expect(keys.lifted(5)).toEqual({
      controls: ["stopPropagation & (event.altKey)"],
      unliftable: [],
    });
  });

  it("keeps a control after a call whose callee reads defaultPrevented in place", () => {
    expect(keys.lifted(6)).toEqual({
      controls: ["stopPropagation"],
      unliftable: ["event.preventDefault()"],
    });
  });

  it("gives a function's own lifted controls, the statements a target takes out of it", () => {
    expect(
      ownControls(keys.named("save"), keys.component).map((each) => keys.text(each.span)),
    ).toEqual(["event.preventDefault();"]);
  });

  // The keyboard handlers the analyser accepts (UF3033 rejects only a control after an `await` or
  // in a callback): a control beside other statements in an `if` block, in an `else` branch or a
  // `switch` case is no control at the top.
  const blocks = analysed("Blocks", [
    'import { ref } from "unframework";',
    "export default function Blocks() {",
    "  const count = ref(0);",
    "  return (",
    "    <div>",
    '      <input aria-label="A" onKeydown={(event) => { if (event.key === "Enter") { event.preventDefault(); count.value += 1; } }} />',
    '      <input aria-label="B" onKeydown={(event) => { if (event.key === "a") count.value = 1; else if (event.key === "b") event.preventDefault(); }} />',
    '      <input aria-label="C" onKeydown={(event) => { if (event.key === "a") { count.value = 1; } else { event.preventDefault(); } }} />',
    '      <input aria-label="D" onKeydown={(event) => { switch (event.key) { case "ArrowDown": event.preventDefault(); count.value += 1; break; } }} />',
    "    </div>",
    "  );",
    "}",
  ]);

  it("keeps a control in a block beside other statements, an `else` or a `switch` case in place", () => {
    expect(blocks.diagnostics).toEqual([]);
    for (const index of [0, 1, 2, 3]) {
      expect(blocks.lifted(index)).toEqual({
        controls: [],
        unliftable: ["event.preventDefault()"],
      });
    }
    expect(requiredCapabilities(blocks.module).has("conditional-event-control")).toBe(true);
  });
});

describe("handedControls (ADR-0047)", () => {
  // A local function that makes a control and captures something of the component, handed as a
  // value or called from anywhere but a template listener's top, runs its controls as local
  // functions run: later on Qwik. One that captures nothing runs at once everywhere.
  const hotkeys = analysed("Hotkeys", [
    'import { onMounted, onUnmounted, ref, useTemplateRef } from "unframework";',
    "export default function Hotkeys() {",
    "  const blocked = ref(0);",
    "  const stopped = ref(0);",
    "  const field = useTemplateRef<HTMLInputElement>();",
    '  function blockDigits(event: KeyboardEvent) { if (event.key >= "0" && event.key <= "9") event.preventDefault(); blocked.value += 1; }',
    "  function stop(event: Event) { event.stopPropagation(); stopped.value += 1; }",
    "  function relay(event: KeyboardEvent) { stop(event); }",
    "  function cancel(event: Event) { event.preventDefault(); }",
    "  function log(event: KeyboardEvent) { console.log(event.key); }",
    "  function save() { blocked.value = 0; }",
    '  onMounted(() => field.value?.addEventListener("keydown", blockDigits));',
    "  onMounted(() => {",
    '    document.addEventListener("keyup", relay as EventListener);',
    '    document.addEventListener("keypress", log);',
    '    document.addEventListener("keydown", cancel);',
    '    document.addEventListener("keydown", (event) => relay(event));',
    '    document.addEventListener("keydown", (event) => { if (event.key === "s") event.preventDefault(); });',
    '    document.addEventListener("keydown", (event) => { cancel(event); save(); event.preventDefault(); });',
    "  });",
    '  onMounted(() => { stop(new Event("x")); });',
    "  onUnmounted(() => {",
    '    document.removeEventListener("keyup", relay as EventListener);',
    '    document.removeEventListener("keypress", log);',
    "  });",
    "  return <input ref={field} aria-label={`Blocked ${blocked.value} ${stopped.value}`} />;",
    "}",
  ]);

  it("compiles the source", () => {
    expect(hotkeys.diagnostics).toEqual([]);
  });

  it("finds each place a function that makes a control is handed or called apart from a listener", () => {
    expect(handedControls(hotkeys.component).map(hotkeys.text)).toEqual([
      "stop",
      "blockDigits",
      "relay",
      "relay",
      "event.preventDefault()",
      "stop",
    ]);
  });

  it("derives `conditional-event-control` where the first one is", () => {
    const at = hotkeys.source.indexOf("stop(event); }");
    expect(requiredCapabilities(hotkeys.module).get("conditional-event-control")).toEqual(
      span(at, at + "stop".length),
    );
  });
});
