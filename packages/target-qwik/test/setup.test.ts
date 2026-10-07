// M2's shapes (ADR-0045 to ADR-0049), from sources the analyser lowers: what
// each setup item, function, watcher, hook, event and listener prints as. Each shape here passes
// L3, L4 and L5 (test/lint-probes.ts pins it under L5; the corpus's goldens under all three), and
// test/behaviour.browser.test.ts runs it.
import { requiredCapabilities } from "@unframework/codegen";
import { describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { emitSource, lower } from "./lower.ts";

/** A source with the authoring imports it needs. */
const source = (imports: string, body: string) =>
  `import { ${imports} } from "unframework";\n\n${body}`;

describe("qwik target: state, derived values and constants", () => {
  it("writes ref as useSignal, computed as useComputed$, a setup let as a signal", async () => {
    const contents = await emitSource(
      source(
        "computed, ref",
        `export interface CounterProps { initial?: number }
export function Counter({ initial = 0 }: CounterProps) {
  const count = ref(initial);
  const label = ref<string>();
  const doubled = computed<number>(() => count.value * 2);
  let clicks = 0;
  function add() {
    clicks += 1;
    count.value += clicks;
    label.value = \`\${doubled.value}\`;
  }
  return <button type="button" onClick={add}>{count.value} {label.value}</button>;
}`,
      ),
    );
    expect(contents).toContain("const count = useSignal(initial);");
    expect(contents).toContain("const label = useSignal<string>();");
    expect(contents).toContain("const doubled = useComputed$<number>(() => count.value * 2);");
    // A plain `let` would be copied into each `$` scope that captures it (ADR-0045).
    expect(contents).toContain("const clicks = useSignal(0);");
    expect(contents).toContain("clicks.value += 1;\n    count.value += clicks.value;");
  });

  it("keeps a template ref in a signal and an id under the generated prefix", async () => {
    const contents = await emitSource(
      source(
        "useId, useTemplateRef",
        `export function Field() {
  const field = useTemplateRef<HTMLInputElement>();
  const id = useId();
  function focus() {
    field.value?.focus();
  }
  return <div><label for={id}>Name</label><input id={id} ref={field} /><button type="button" onClick={focus}>Edit</button></div>;
}`,
      ),
    );
    expect(contents).toContain("const field = useSignal<HTMLInputElement>();");
    // `use-method-usage` refuses a `use*` call inside a template literal: a concatenation.
    expect(contents).toContain('const id = "uf-id-" + useId();');
    expect(contents).toContain("<input id={id} ref={field} />");
  });

  it("moves what captures nothing to module scope, and keeps a constant reading a prop once", async () => {
    const contents = await emitSource(
      source(
        "computed, ref",
        `export function Price({ amount }: { amount: number }) {
  const rates = { standard: 0, express: 1200 };
  function cents(value: number): string {
    return (value / 100).toFixed(2);
  }
  const first = \`From \${cents(amount)}\`;
  const method = ref<"standard" | "express">("standard");
  const total = computed(() => cents(amount + rates[method.value]));
  return <p title={first}>{total.value}</p>;
}`,
      ),
    );
    expect(contents).toMatch(
      /const rates = \{ standard: 0, express: 1200 \};\n\nfunction cents\(value: number\): string \{\n {2}return \(value \/ 100\)\.toFixed\(2\);\n\}\n\nexport const Price/,
    );
    // A `const` reading a prop evaluates once (setup runs once, ADR-0045).
    expect(contents).toContain("const first = useConstant(() => `From ${cents(amount)}`);");
  });
});

describe("qwik target: local functions", () => {
  it("makes a function client code calls a $() QRL, awaits its calls and makes callers async", async () => {
    const contents = await emitSource(
      source(
        "defineEmits, ref",
        `export function Tally() {
  const emit = defineEmits<{ total: [value: number] }>();
  const count = ref(0);
  function report() {
    addTen();
    emit("total", count.value);
  }
  function addTen() {
    count.value += 10;
  }
  return <button type="button" onClick={report}>{count.value}</button>;
}`,
      ),
    );
    // `report` reads `addTen`, declared after it: a `$` scope captures what it reads when it is
    // created, so `addTen` comes first.
    expect(contents).toContain(
      [
        "  const addTen = $(() => {",
        "    count.value += 10;",
        "  });",
        "",
        "  const report = $(async () => {",
        "    await addTen();",
        "    onTotal$?.(count.value);",
        "  });",
      ].join("\n"),
    );
  });

  it("keeps a function render calls plain, with a QRL twin for client code", async () => {
    const contents = await emitSource(
      source(
        "defineEmits, ref",
        `export function Units() {
  const emit = defineEmits<{ pick: [label: string] }>();
  const unit = ref("kg");
  function label(value: number) {
    return \`\${value} \${unit.value}\`;
  }
  return <button type="button" onClick={() => emit("pick", label(2))}>{label(1)}</button>;
}`,
      ),
    );
    expect(contents).toContain("  function label(value: number) {");
    expect(contents).toContain("  const labelQrl = $((value: number) => {");
    expect(contents).toContain("{label(1)}");
    expect(contents).toContain("onClick$={async () => onPick$?.(await labelQrl(2))}");
  });

  it("leaves an arrow body that returns a QRL's call as it is", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Search() {
  const query = ref("");
  function search(term: string) {
    query.value = term;
  }
  return <div><input onKeydown={(event) => event.key === "Escape" && search("")} /><button type="button" onClick={() => search("a")}>{query.value}</button></div>;
}`,
      ),
    );
    expect(contents).toContain('onKeyDown$={(event) => event.key === "Escape" && search("")}');
    expect(contents).toContain('onClick$={() => search("a")}');
  });
});

describe("qwik target: events a component emits", () => {
  it("declares each event's QRL prop beside the props type, and calls it", async () => {
    const contents = await emitSource(
      source(
        "defineEmits",
        `export interface RowProps { path: string }
export function Row({ path }: RowProps) {
  const emit = defineEmits<{ open: [path: string]; share: [path: string, note?: string]; idle: [] }>();
  return <div><button type="button" onClick={() => emit("open", path)}>Open</button><button type="button" onClick={() => emit("share", path)}>Share</button></div>;
}`,
      ),
    );
    expect(contents).toContain(
      [
        "export interface RowEvents {",
        "  onOpen$?: QRL<(path: string) => void>;",
        "  onShare$?: QRL<(path: string, note?: string) => void>;",
        "  onIdle$?: QRL<() => void>;",
        "}",
      ].join("\n"),
    );
    // Only emitted events are destructured; an emit does not wait for its listener (ADR-0047).
    expect(contents).toContain(
      "export const Row = component$<RowProps & RowEvents>(({ path, onOpen$, onShare$ }) => {",
    );
    expect(contents).toContain("onClick$={() => onOpen$?.(path)}");
  });

  it("calls the props object's QRL in the object form", async () => {
    const contents = await emitSource(
      source(
        "defineEmits",
        `export interface RowProps { path: string }
export function Row(props: RowProps) {
  const emit = defineEmits<{ open: [path: string] }>();
  return <button type="button" onClick={() => emit("open", props.path)}>Open</button>;
}`,
      ),
    );
    expect(contents).toContain("component$<RowProps & RowEvents>((props) => {");
    expect(contents).toContain("onClick$={() => props.onOpen$?.(props.path)}");
  });
});

describe("qwik target: watchers, effects and lifecycle", () => {
  it("watches a ref in a task with the previous value in a signal", async () => {
    const contents = await emitSource(
      source(
        "ref, watch",
        `export function Zoom() {
  const zoom = ref(100);
  const history = ref<string[]>([]);
  watch(zoom, (value, previous) => {
    history.value = [...history.value, \`\${previous} to \${value}\`];
  });
  return <button type="button" onClick={() => (zoom.value += 25)}>{history.value.join()}</button>;
}`,
      ),
    );
    expect(contents).toContain(
      [
        "  const previousZoom = useSignal(() => zoom.value);",
        "  useTask$(",
        "    ({ track }) => {",
        "      const value = track(zoom);",
        "      const previous = previousZoom.value;",
        "      if (Object.is(value, previous)) return;",
        "      previousZoom.value = value;",
        "      history.value = [...history.value, `${previous} to ${value}`];",
        "    },",
        "    { deferUpdates: false },",
        "  );",
      ].join("\n"),
    );
  });

  it("tracks a getter through useComputed$, an array source as a tuple, and a prop as a read", async () => {
    const contents = await emitSource(
      source(
        "defineEmits, ref, watch",
        `export function Range({ currency }: { currency: string }) {
  const emit = defineEmits<{ span: [span: number]; range: [low: number, high: number]; currencyUpdate: [currency: string] }>();
  const low = ref(10);
  const high = ref(50);
  watch(() => high.value - low.value, (span) => {
    emit("span", span);
  });
  watch([low, high], ([minimum, maximum]) => {
    emit("range", minimum, maximum);
  });
  watch(() => currency, (value) => {
    emit("currencyUpdate", value);
  });
  return <button type="button" onClick={() => (high.value += 10)}>{low.value}</button>;
}`,
      ),
    );
    expect(contents).toContain("const spanSource = useComputed$(() => high.value - low.value);");
    expect(contents).toContain("const span = track(spanSource);");
    // A mutable tuple, as Vue gives the callback: a function that takes an array takes it.
    expect(contents).toContain(
      "const previousValues = useSignal<[typeof low.value, typeof high.value]>(() => [\n      low.value,\n      high.value,\n    ]);",
    );
    expect(contents).toContain(
      "const values: [typeof low.value, typeof high.value] = [track(low), track(high)];",
    );
    expect(contents).toContain(
      "if (values.every((item, index) => Object.is(item, previousValues.value[index]))) return;",
    );
    expect(contents).toContain("const [minimum, maximum] = values;");
    expect(contents).toContain("const value = track(() => currency);");
  });

  it("calls an immediate watcher back on its first run, and keeps onCleanup for its next callback", async () => {
    const contents = await emitSource(
      source(
        "defineEmits, ref, watch",
        `export function Channel() {
  const emit = defineEmits<{ join: [channel: string]; leave: [channel: string] }>();
  const channel = ref("general");
  watch(() => channel.value.toLowerCase(), (name, previous, onCleanup) => {
    emit("join", name);
    onCleanup(() => {
      emit("leave", name);
    });
  }, { immediate: true });
  return <button type="button" onClick={() => (channel.value = "random")}>{channel.value}</button>;
}`,
      ),
    );
    expect(contents).toContain(
      [
        "  const nameSource = useComputed$(() => channel.value.toLowerCase());",
        "  const previousName = useSignal<{ value: typeof nameSource.value }>();",
        "  const nameCleanups = useConstant(() => noSerialize<(() => void)[]>([]));",
        "  useTask$(",
        "    ({ track }) => {",
        "      const name = track(nameSource);",
        "      const last = previousName.value;",
        "      if (last && Object.is(name, last.value)) return;",
        "      previousName.value = { value: name };",
        "      for (const callback of nameCleanups?.splice(0) ?? []) callback();",
        "      const onCleanup = (callback: () => void) => void nameCleanups?.push(callback);",
      ].join("\n"),
    );
    expect(contents).toContain(
      [
        "  useVisibleTask$(",
        "    ({ cleanup }) => {",
        "      cleanup(() => {",
        "        for (const callback of nameCleanups?.splice(0) ?? []) callback();",
        "      });",
        "    },",
        '    { strategy: "document-ready" },',
        "  );",
      ].join("\n"),
    );
  });

  it("runs post watchers, watchEffect and the lifecycle hooks in visible tasks", async () => {
    const contents = await emitSource(
      source(
        "defineEmits, onMounted, onUnmounted, ref, useTemplateRef, watch, watchEffect",
        `export function Feed({ app }: { app: string }) {
  const emit = defineEmits<{ rendered: [count: number]; title: [title: string]; ready: [] }>();
  const items = ref(["a"]);
  const list = useTemplateRef<HTMLUListElement>();
  let timer: ReturnType<typeof setInterval> | undefined;
  watch(items, () => {
    emit("rendered", list.value?.childElementCount ?? 0);
  }, { flush: "post" });
  watchEffect(() => {
    emit("title", \`(\${items.value.length}) \${app}\`);
  });
  onMounted(() => {
    timer = setInterval(() => emit("ready"), 1000);
  });
  onUnmounted(() => {
    clearInterval(timer);
  });
  return <ul ref={list}>{items.value.map((item) => <li key={item}>{item}</li>)}</ul>;
}`,
      ),
    );
    // Compared without the indentation, which the component's width decides.
    const lines = contents.split("\n").map((line) => line.trim());
    const at = (...expected: string[]) => {
      const start = lines.indexOf(expected[0]!);
      expect(lines.slice(start, start + expected.length)).toEqual(expected);
    };
    at(
      "const previousItems = useSignal(() => items.value);",
      "useVisibleTask$(",
      "({ track }) => {",
      "const value = track(items);",
      "if (Object.is(value, previousItems.value)) return;",
      "previousItems.value = value;",
      "onRendered$?.(list.value?.childElementCount ?? 0);",
      "},",
      '{ strategy: "document-ready" },',
    );
    // Qwik 2.0.0-beta.47 may run a visible task twice for one change: the effect runs only when
    // a value it read changed.
    at(
      "const previousEffect = useSignal<[typeof items.value, typeof app]>();",
      "useVisibleTask$(",
      "({ track }) => {",
      "const values: [typeof items.value, typeof app] = [track(items), track(() => app)];",
      "const last = previousEffect.value;",
      "if (last && values.every((item, index) => Object.is(item, last[index]))) return;",
      "previousEffect.value = values;",
      "onTitle$?.(`(${items.value.length}) ${app}`);",
      "},",
      '{ strategy: "document-ready" },',
    );
    at("timer.value = setInterval(() => onReady$?.(), 1000);");
    at("({ cleanup }) => {", "cleanup(() => {", "clearInterval(timer.value);", "});");
  });

  it("waits a task in nextTick, and reads a ref in a conditional through rendered()", async () => {
    const contents = await emitSource(
      source(
        "defineEmits, nextTick, ref, useTemplateRef",
        `export function Details() {
  const emit = defineEmits<{ toggled: [items: number] }>();
  const open = ref(false);
  const details = useTemplateRef<HTMLUListElement>();
  async function toggle() {
    open.value = !open.value;
    await nextTick();
    emit("toggled", details.value?.childElementCount ?? 0);
  }
  return <section><button type="button" onClick={toggle}>Details</button>{open.value && <ul ref={details}><li>One</li></ul>}</section>;
}`,
      ),
    );
    expect(contents).toContain("await nextTick();");
    expect(contents).toContain("onToggled$?.(rendered(details.value)?.childElementCount ?? 0);");
    expect(contents).toMatch(
      /\nfunction nextTick\(\): Promise<void> \{\n {2}return new Promise\(\(resolve\) => setTimeout\(resolve\)\);\n\}\n/,
    );
    expect(contents).toMatch(
      /\nfunction rendered<T extends Element>\(element: T \| undefined\): T \| null \{\n {2}return element\?\.isConnected \? element : null;\n\}\n$/,
    );
  });
});

describe("qwik target: listeners", () => {
  it("names listeners by Qwik's event props and moves event controls to the loader", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Form() {
  const tags = ref<string[]>([]);
  function blockComma(event: KeyboardEvent) {
    if (event.key === ",") event.preventDefault();
  }
  function add(event: SubmitEvent) {
    event.preventDefault();
    tags.value = [...tags.value, "x"];
  }
  function key(event: KeyboardEvent) {
    if (event.key === "Enter") event.preventDefault();
    tags.value = [event.key];
  }
  return <form onSubmit={add}><input onKeydown={blockComma} onDblclick={() => (tags.value = [])} /><input onKeydown={key} /><p>{tags.value.join()}</p></form>;
}`,
      ),
    );
    // A handler of only conditional controls is a \`sync$\` handler, and is not declared.
    expect(contents).toContain(
      'onKeyDown$={sync$((event: KeyboardEvent) => {\n          if (event.key === ",") event.preventDefault();\n        })}\n        onDblClick$={() => (tags.value = [])}',
    );
    expect(contents).not.toContain("const blockComma");
    expect(contents).toContain("<form preventdefault:submit onSubmit$={add}>");
    expect(contents).toContain('const add = $(() => {\n    tags.value = [...tags.value, "x"];');
    // Beside a \`$\` handler, a conditional \`preventDefault()\` runs in a \`sync$\` before it, on the
    // element (Qwik's loader queues the handler behind it, which the semantics page declares).
    expect(contents).toContain(
      'onKeyDown$={[\n          sync$((event: KeyboardEvent) => {\n            if (event.key === "Enter") event.preventDefault();\n          }),\n          key,\n        ]}',
    );
    expect(contents).not.toContain("window:");
  });

  it("reads event.currentTarget as Qwik's element argument", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Note() {
  const note = ref("");
  function update(event: InputEvent) {
    note.value = (event.currentTarget as HTMLInputElement).value;
  }
  return <div><input onInput={update} /><input onChange={(event) => (note.value = (event.currentTarget as HTMLInputElement).value)} /><p>{note.value}</p></div>;
}`,
      ),
    );
    expect(contents).toContain(
      "const update = $((event: InputEvent, element: Element) => {\n    note.value = (element as HTMLInputElement).value;",
    );
    expect(contents).toContain(
      "onChange$={(_, element) => (note.value = (element as HTMLInputElement).value)}",
    );
  });

  it("writes capture, passive and once, and a capture listener beside a bubble one from the window", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Log() {
  const log = ref<string[]>([]);
  function record(line: string) {
    log.value = [...log.value, line];
  }
  return (
    <section>
      <div role="presentation" onClickCapture={() => record("capture")}><button type="button" onClick={() => record("button")}>A</button></div>
      <div role="presentation" onClickCapture={() => record("both capture")} onClick={() => record("both bubble")}><button type="button">B</button></div>
      <button type="button" onClickOnce={(event) => { event.stopPropagation(); record("once"); }}>C</button>
      <div role="group" aria-label="Scroll" onWheelPassive={() => record("wheel")}>{log.value.join()}</div>
    </section>
  );
}`,
      ),
    );
    // An element with a capture listener only: Qwik's `capture:`; but every capture listener of an
    // event an element also takes in the bubble phase runs from the window, in document order.
    // Another listener of the event runs after the window's in the same dispatch, so the capture
    // listener's call runs in place, before it (./inline.ts).
    expect(contents).toContain(
      'window:onClick$={(event, element) => {\n          if (!element.contains(event.target as Node)) return;\n          log.value = [...log.value, "capture"];\n        }}',
    );
    // A bubble listener after a capture listener on its path is a handler of its own: Qwik's
    // loader runs it after the capture listener once its code has loaded (ADR-0050), with no
    // wait of the target's, which would queue it behind every handler still running.
    expect(contents).toContain('<button type="button" onClick$={() => record("button")}>');
    expect(contents).toContain('onClick$={() => record("both bubble")}');
    expect(contents).toContain(
      [
        "stoppropagation:click",
        "        onClick$={async (_, element) => {",
        "          if (onceClick.has(element)) return;",
        "          onceClick.add(element);",
        '          element.removeAttribute("stoppropagation:click");',
        '          await record("once");',
      ].join("\n"),
    );
    expect(contents).toContain('passive:wheel onWheel$={() => record("wheel")}');
    expect(contents).toMatch(/\nconst onceClick = new WeakSet<Element>\(\);\n$/);
    expect(contents).not.toContain("Promise.resolve");
  });

  it("uses Qwik's capture: where an element's capture listener is its only click listener", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Panel() {
  const log = ref<string[]>([]);
  return <div role="presentation" onClickCapture={() => (log.value = [...log.value, "capture"])}><button type="button">{log.value.join()}</button></div>;
}`,
      ),
    );
    expect(contents).toContain(
      '<div role="presentation" capture:click onClick$={() => (log.value = [...log.value, "capture"])}>',
    );
  });

  it("moves the controls of a function a handler passes its event to, and passes the element on", async () => {
    const contents = await emitSource(
      source(
        "defineEmits, ref",
        `export interface Item { id: string; label: string }
export function Picker({ items }: { items: Item[] }) {
  const emit = defineEmits<{ picked: [id: string, value: string] }>();
  const chosen = ref<string>();
  function pick(item: Item, event: MouseEvent) {
    event.preventDefault();
    if (event.shiftKey) event.stopPropagation();
    chosen.value = item.id;
    emit("picked", item.id, (event.currentTarget as HTMLAnchorElement).text);
  }
  return <ul>{items.map((item) => <li key={item.id}><a href={\`#\${item.id}\`} onClick={(event) => pick(item, event)}>{item.label}</a></li>)}<li>{chosen.value ?? "none"}</li></ul>;
}`,
      ),
    );
    expect(contents).toContain(
      "const pick = $((item: Item, event: MouseEvent, element: Element) => {\n    chosen.value = item.id;",
    );
    expect(contents).toContain("preventdefault:click");
    expect(contents).toContain(
      "sync$((event: PointerEvent) => {\n                if (event.shiftKey) event.stopPropagation();",
    );
    // In an array, `$()` types nothing: the arrow's parameters carry their types.
    expect(contents).toContain(
      "$((event: PointerEvent, element: Element) => pick(item, event, element))",
    );
  });

  it("declares a once listener whose control depends on a condition unsupported, and still writes it", async () => {
    const field = source(
      "ref",
      `export function Field() {
  const keys = ref(0);
  return <input onKeydownOnce={(event) => { if (event.key === "Enter") event.preventDefault(); keys.value++; }} />;
}`,
    );
    // A \`sync$\` handler captures nothing, so it cannot know whether the listener already ran:
    // Qwik's cell declares it (UF4001), and the target writes the output without the once.
    expect(target.capabilities["conditional-event-control"]).toMatchObject({
      support: "unsupported",
      code: "UF4001",
      severity: "error",
    });
    expect(requiredCapabilities(lower(field)).has("conditional-event-control")).toBe(true);
    expect(await emitSource(field)).toContain(
      'sync$((event: KeyboardEvent) => {\n          if (event.key === "Enter") event.preventDefault();\n        })',
    );
  });

  it("passes a module-level function as a handler through its own QRL", async () => {
    const contents = await emitSource(
      `export function Logger() {
  function log(event: MouseEvent) {
    console.info(event.type);
  }
  return <button type="button" onClick={log}>Log</button>;
}`,
    );
    expect(contents).toContain("function log(event: MouseEvent) {");
    expect(contents).toContain("onClick$={$(log)}");
  });
});

describe("qwik target: listener order, calls in place and controls (ADR-0047)", () => {
  it("runs the listeners of one element and event in one handler, in attribute order", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Order() {
  const log = ref<string[]>([]);
  function record(line: string) {
    log.value = [...log.value, line];
  }
  return (
    <div role="presentation" onClick={() => record("toolbar")}>
      <button type="button" onClick={() => record("save")} onClickOnce={() => record("first save")}>Save</button>
      <p>{log.value.join()}</p>
    </div>
  );
}`,
      ),
    );
    // One handler, never an array of \`$\` handlers between which Qwik would run the toolbar's;
    // the once guard inline; the calls in place, since the toolbar's listener runs after it.
    expect(contents).toContain(
      [
        "onClick$={(_, element) => {",
        '          log.value = [...log.value, "save"];',
        "          if (!onceClick.has(element)) {",
        "            onceClick.add(element);",
        '            log.value = [...log.value, "first save"];',
        "          }",
        "        }}",
      ].join("\n"),
    );
    // The toolbar's listener runs last: its call stays a QRL call, and its handler is its own.
    expect(contents).toContain('<div role="presentation" onClick$={() => record("toolbar")}>');
    expect(contents).not.toContain("Promise.resolve");
  });

  it("writes in place the calls of a handler an ancestor's listener of its event follows", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Picker({ names }: { names: string[] }) {
  const selected = ref("none");
  const hits = ref(0);
  function pick(name: string) {
    const upper = name.toUpperCase();
    selected.value = upper;
    hits.value++;
  }
  function report() {
    console.info(selected.value, hits.value);
  }
  return (
    <div role="presentation" onClick={report}>
      {names.map((name) => (
        <button key={name} type="button" onClick={() => pick(name)}>{name}</button>
      ))}
      <button type="button" onClick={() => { pick("all"); pick(names.join()); }}>All</button>
    </div>
  );
}`,
      ),
    );
    // Qwik would load \`pick\`'s segment after the handler's, and run \`report\` first.
    expect(contents).toContain(
      "onClick$={() => {\n            const upper = name.toUpperCase();\n            selected.value = upper;",
    );
    // A literal argument takes the parameter's place; another is a \`const\`, in a block.
    expect(contents).toContain(
      '{\n            const upper = "all".toUpperCase();\n            selected.value = upper;\n            hits.value++;\n          }',
    );
    expect(contents).toContain(
      "{\n            const name: string = names.join();\n            const upper = name.toUpperCase();",
    );
    // Every call of \`pick\` is in place: it has no QRL.
    expect(contents).not.toContain("const pick");
    expect(contents).toContain("const report = $(() => {");
  });

  it("calls an async function it does not await as its QRL, which goes on without waiting for it", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Floating() {
  const status = ref("idle");
  async function run() {
    status.value = "running";
    await Promise.resolve();
    status.value = "done";
  }
  function start() {
    run();
    status.value = "started";
  }
  return <button type="button" onClick={start}>{status.value}</button>;
}`,
      ),
    );
    // Once its code has loaded, the QRL's call runs \`run\`'s synchronous part before \`start\`
    // goes on (a listener's first run is declared): one declaration, never a copy in the caller.
    expect(contents).toContain(
      'const run = $(async () => {\n    status.value = "running";\n    await Promise.resolve();',
    );
    expect(contents).toContain(
      'const start = $(() => {\n    void run();\n    status.value = "started";',
    );
    expect(contents).not.toContain("async function run");
  });

  it("keeps a call of a function that returns a promise as the promise, awaited only where the source awaits it", async () => {
    const contents = await emitSource(
      source(
        "ref, defineEmits, watch",
        `export function Floating() {
  const emit = defineEmits<{ seen: [status: string] }>();
  const status = ref("idle");
  const volume = ref(4);
  let replies: ((text: string) => void)[] = [];
  function ask(): Promise<string> {
    return new Promise<string>((resolve) => {
      replies = [...replies, resolve];
    });
  }
  async function save() {
    status.value = "saving";
    await Promise.resolve();
    status.value = "saved";
  }
  async function chain() {
    await save();
    emit("seen", status.value);
  }
  function refresh() {
    ask().then((text) => {
      status.value = text;
    });
  }
  async function race() {
    const pending = ask();
    status.value = "waiting";
    status.value = await Promise.race([pending, ask()]);
  }
  function apply(value: number) {
    if (value > 10) value = 10;
    emit("seen", \`\${value}\`);
  }
  watch(volume, (next) => {
    apply(next * 2);
  });
  return (
    <section>
      <button type="button" onClick={() => { save(); emit("seen", status.value); }}>Bare</button>
      <button type="button" onClick={() => { const pending = save(); emit("seen", status.value); void pending; }}>Pending</button>
      <button type="button" onClick={chain}>Chain</button>
      <button type="button" onClick={refresh}>Refresh</button>
      <button type="button" onClick={race}>Race</button>
      <button type="button" onClick={() => (volume.value += 3)}>Louder</button>
    </section>
  );
}`,
      ),
    );
    expect(contents).toContain("void save();\n          onSeen$?.(status.value);");
    expect(contents).toContain("const pending = save();\n          onSeen$?.(status.value);");
    // Awaited: the QRL, whose promise the caller waits for.
    expect(contents).toContain("const chain = $(async () => {\n    await save();");
    expect(contents).toContain("const save = $(async () => {");
    // A promise used as a value stays the promise (\`.then\`, held, passed on).
    expect(contents).toContain("const refresh = $(() => {\n    ask().then((text) => {");
    expect(contents).toContain(
      'const pending = ask();\n    status.value = "waiting";\n    status.value = await Promise.race([pending, ask()]);',
    );
    expect(contents).not.toContain("await ask()");
    // A spliced call binds a parameter the function assigns with \`let\`.
    expect(contents).toContain("let value: number = next * 2;\n      if (value > 10) value = 10;");
  });

  it("keeps a marker that a listener running every time needs after a once listener's first run", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Signup() {
  const count = ref(0);
  return (
    <form aria-label="Sign up" onSubmitOnce={(event) => { event.preventDefault(); count.value = 1; }} onSubmit={(event) => { event.preventDefault(); count.value++; }}>
      <p>{count.value}</p>
    </form>
  );
}`,
      ),
    );
    expect(contents).toContain(
      'aria-label="Sign up"\n      preventdefault:submit\n      onSubmit$={(_, element) => {',
    );
    expect(contents).not.toContain("removeAttribute");
  });

  it("lifts a called function's control under the call's test of the event, or on every event", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Controls() {
  const query = ref("");
  const count = ref(0);
  function clear(event: KeyboardEvent) {
    event.preventDefault();
    query.value = "";
  }
  function halt(event: MouseEvent) {
    event.stopPropagation();
    count.value++;
  }
  return (
    <div>
      <input type="search" onKeydown={(event) => { if (event.key === "Escape") clear(event); }} />
      <button type="button" onClick={(event) => halt(event)}>Halt</button>
      <p>{query.value} {count.value}</p>
    </div>
  );
}`,
      ),
    );
    // Only an Escape is prevented: typing still works.
    expect(contents).not.toContain("preventdefault:keydown");
    expect(contents).toContain(
      'onKeyDown$={[\n          sync$((event: KeyboardEvent) => {\n            if (event.key === "Escape") {\n              event.preventDefault();\n            }\n          }),\n          $(async (event: KeyboardEvent) => {\n            if (event.key === "Escape") await clear(event);\n          }),\n        ]}',
    );
    expect(contents).toContain(
      '<button type="button" stoppropagation:click onClick$={(event) => halt(event)}>',
    );
  });

  it("declares a control a call reaches under a condition on more than the event unsupported", () => {
    const module = lower(
      source(
        "ref",
        `export function Menu() {
  const open = ref(false);
  function close(event: KeyboardEvent) {
    event.preventDefault();
    open.value = false;
  }
  return <input type="text" onKeydown={(event) => { if (open.value) close(event); }} />;
}`,
      ),
    );
    expect(requiredCapabilities(module).has("conditional-event-control")).toBe(true);
  });

  it("declares a once listener's conditional control unsupported", () => {
    const module = lower(
      source(
        "ref",
        `export function Message() {
  const started = ref(false);
  return <textarea aria-label="Message" onKeydownOnce={(event) => { if (event.key === "Enter") event.preventDefault(); started.value = true; }} />;
}`,
      ),
    );
    // A \`sync$\` handler captures nothing: it cannot tell the listener's first event.
    expect(requiredCapabilities(module).has("conditional-event-control")).toBe(true);
    expect(target.capabilities["conditional-event-control"]).toMatchObject({
      support: "unsupported",
      code: "UF4001",
      severity: "error",
    });
  });

  it("declares a derived value or a watcher that reads an optional prop unsupported (late-prop)", () => {
    const module = lower(
      source(
        "computed, watch",
        `export function Pages({ page = 1, total }: { page?: number; total: number }) {
  const label = computed(() => \`\${page} of \${total}\`);
  watch(() => page, (next) => console.info(next));
  return <p>{label.value}</p>;
}`,
      ),
    );
    // Qwik's props proxy subscribes a reader only to the keys the props hold.
    expect(requiredCapabilities(module).has("late-prop")).toBe(true);
    expect(target.capabilities["late-prop"]).toMatchObject({
      support: "unsupported",
      code: "UF4001",
      severity: "warning",
    });
  });

  it("runs an element's bubble controls in sync$ where its capture listener runs from the window", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Phases() {
  const log = ref<string[]>([]);
  return (
    <div role="presentation" onClickCapture={() => (log.value = [...log.value, "capture"])} onClick={(event) => { event.stopPropagation(); log.value = [...log.value, "bubble"]; }}>
      <p>{log.value.join()}</p>
    </div>
  );
}`,
      ),
    );
    // Qwik's loader applies an element's markers to every event it broadcasts to its window
    // listener, wherever it happened: a marker would stop every click on the page.
    expect(contents).not.toContain("stoppropagation:click");
    expect(contents).toContain(
      "onClick$={[\n        sync$((event: PointerEvent) => {\n          event.stopPropagation();\n        }),",
    );
  });

  it("listens non-passively where the component also listens to the event otherwise", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Wheel() {
  const log = ref<string[]>([]);
  return (
    <div role="group" aria-label="Outer" onWheel={() => (log.value = [...log.value, "outer"])}>
      <div role="group" aria-label="Inner" onWheelPassive={() => { log.value = [...log.value, "inner"]; }}>{log.value.join()}</div>
    </div>
  );
}`,
      ),
    );
    // Qwik dispatches passive handlers from a document listener of their own, after (or before)
    // every other one on the path.
    expect(contents).not.toContain("passive:wheel");
    expect(contents).toContain('onWheel$={() => {\n          log.value = [...log.value, "inner"];');
  });

  it("writes the calls of a type predicate and an assertion function in place, keeping their narrowing", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `type Size = "sm" | "md";
export function Narrow({ sizes }: { sizes: string[] }) {
  const size = ref<Size>("md");
  const isKnown = (value: string): value is Size => sizes.includes(value) && value !== size.value;
  function assertKnown(value: string): asserts value is Size {
    if (!isKnown(value)) throw new Error(value);
  }
  function set(value: string) {
    if (isKnown(value)) size.value = value;
  }
  function force(value: string) {
    assertKnown(value);
    size.value = value;
  }
  return (
    <div>
      <output>{size.value}</output>
      <button type="button" onClick={() => set("sm")}>Small</button>
      <button type="button" onClick={() => force("md")}>Medium</button>
    </div>
  );
}`,
      ),
    );
    // A QRL's call is a promise, which narrows nothing: the predicate is declared where it is
    // called, and the assertion, which never returns, is written in place.
    expect(contents).toContain(
      "const set = $((value: string) => {\n    const isKnown = (value: string): value is Size => sizes.includes(value) && value !== size.value;\n\n    if (isKnown(value)) size.value = value;",
    );
    expect(contents).toContain(
      "const force = $((value: string) => {\n    {\n      const isKnown = (value: string): value is Size =>\n        sizes.includes(value) && value !== size.value;\n\n      if (!isKnown(value)) throw new Error(value);\n    }\n    size.value = value;",
    );
    expect(contents).not.toContain("await");
    expect(contents).not.toMatch(/const (isKnown|assertKnown) = \$/);
  });

  it("declares an assertion function that returns early where it is called, never an arrow called in place", async () => {
    const contents = await emitSource(
      source(
        "ref, defineEmits",
        `interface Item {
  id: string;
}
export function Asserts() {
  const emit = defineEmits<{ checked: [id: string] }>();
  const items = ref<Item[]>([{ id: "a" }]);
  const checks = ref(0);
  function assertItem(value: Item | undefined): asserts value is Item {
    checks.value += 1;
    if (value !== undefined) return;
    throw new Error("missing");
  }
  function check(index: number) {
    const value = items.value[index];
    assertItem(value);
    emit("checked", value.id);
  }
  return <button type="button" onClick={() => check(0)}>{checks.value}</button>;
}`,
      ),
    );
    // TypeScript narrows through an assertion only when it calls it by name (TS2776).
    expect(contents).toContain(
      [
        "const check = $((index: number) => {",
        "    function assertItem(value: Item | undefined): asserts value is Item {",
        "      checks.value += 1;",
        "      if (value !== undefined) return;",
        '      throw new Error("missing");',
        "    }",
        "",
        "    const value = items.value[index];",
        "    assertItem(value);",
        "    onChecked$?.(value.id);",
      ].join("\n"),
    );
    expect(contents).not.toContain(")(value)");
  });
});

describe("qwik target: controls at dispatch and merged listeners (ADR-0047)", () => {
  it("passes Qwik's element to a sync$ whose test reads currentTarget, own or a call's", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Backdrop() {
  const open = ref(true);
  const log = ref<string[]>([]);
  function close(event: MouseEvent) {
    event.preventDefault();
    open.value = false;
  }
  function dismiss(event: MouseEvent) {
    event.stopPropagation();
    open.value = false;
  }
  return (
    <section>
      <a href="#own" onClick={(event) => { if (event.target === event.currentTarget) event.preventDefault(); }}>Own</a>
      <a href="#called" onClick={(event) => { if (event.target === event.currentTarget) close(event); }}>Called</a>
      <div role="presentation" onClick={() => (log.value = [...log.value, "page"])}>
        <div role="presentation" onClick={(event) => { if (event.target === event.currentTarget) dismiss(event); }}>Backdrop</div>
      </div>
      <p>{open.value ? "open" : "closed"} {log.value.join()}</p>
    </section>
  );
}`,
      ),
    );
    // Qwik's loader runs every handler from the document: \`currentTarget\` is the element it
    // passes as the second argument.
    expect(contents).toContain(
      "onClick$={sync$((event: PointerEvent, element: Element) => {\n          if (event.target === element) event.preventDefault();\n        })}",
    );
    expect(contents).toContain(
      "onClick$={[\n          sync$((event: PointerEvent, element: Element) => {\n            if (event.target === element) {\n              event.preventDefault();\n            }\n          }),",
    );
    // A conditional \`stopPropagation()\` runs at the element too: beside its handler, in an array.
    expect(contents).toContain(
      "onClick$={[\n            sync$((event: PointerEvent, element: Element) => {\n              if (event.target === element) {\n                event.stopPropagation();\n              }\n            }),",
    );
    expect(contents).not.toContain("event.currentTarget");
  });

  it("merges an element's controls into one sync$ beside its handler, on the element", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Field() {
  const text = ref("");
  function submit(event: KeyboardEvent) {
    event.preventDefault();
    text.value = "";
  }
  return (
    <div role="presentation" onKeydown={() => (text.value = text.value.trim())}>
      <input
        aria-label="Text"
        onKeydown={(event) => {
          if (event.key === ",") event.preventDefault();
          if (event.key === "Enter") submit(event);
        }}
        onInput={(event) => (text.value = (event.target as HTMLInputElement).value)}
      />
    </div>
  );
}`,
      ),
    );
    // One \`sync$\` before the handler: Qwik's loader starts the handler after the \`sync$\`'s
    // promise, after its container's handler (the semantics page declares it).
    expect(contents).toContain(
      [
        "onKeyDown$={[",
        "          sync$((event: KeyboardEvent) => {",
        '            if (event.key === ",") event.preventDefault();',
        '            if (event.key === "Enter") {',
        "              event.preventDefault();",
        "            }",
        "          }),",
      ].join("\n"),
    );
    expect(contents).not.toContain("window:");
  });

  it("never returns a promise from an expression-bodied handler another listener may follow", async () => {
    const contents = await emitSource(
      source(
        "ref, defineEmits",
        `export function Saver() {
  const emit = defineEmits<{ seen: [status: string] }>();
  const status = ref("idle");
  async function save(name: string) {
    status.value = \`saving \${name}\`;
    await Promise.resolve();
    status.value = \`saved \${name}\`;
  }
  return (
    <div role="presentation" onClick={() => emit("seen", status.value)}>
      <button type="button" onClick={() => save("a")}>Save</button>
      <button type="button" onClick={() => emit("seen", "inner")}>Emit</button>
    </div>
  );
}`,
      ),
    );
    // An unawaited call of an async function is its QRL's, floating: one declaration.
    expect(contents).toContain('onClick$={() => {\n          void save("a");\n        }}');
    expect(contents).toContain("const save = $(async (name: string) => {");
    expect(contents).toContain('onClick$={() => {\n          onSeen$?.("inner");\n        }}');
    // The container's handler, which nothing follows, keeps its expression body.
    expect(contents).toContain("onClick$={() => onSeen$?.(status.value)}");
  });

  it("gives each listener of a merged handler a block, the element only where read, and one floating function", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Combos() {
  const log = ref<string[]>([]);
  const count = ref(0);
  async function save() {
    await Promise.resolve();
    count.value += 1;
  }
  return (
    <section>
      <div role="group" aria-label="Zone"
        onWheel={(event) => { const line = \`wheel \${event.deltaY > 0 ? "down" : "up"}\`; log.value = [...log.value, line]; }}
        onWheelPassive={() => { const line = "passive"; log.value = [...log.value, line]; }}>Scroll</div>
      <form aria-label="Form" onSubmit={save} onSubmitOnce={(event) => { event.preventDefault(); log.value = [...log.value, "once"]; }}>
        <button type="submit">{count.value}</button>
      </form>
    </section>
  );
}`,
      ),
    );
    expect(contents).toContain(
      [
        "onWheel$={(event) => {",
        "          {",
        '            const line = `wheel ${event.deltaY > 0 ? "down" : "up"}`;',
        "            log.value = [...log.value, line];",
        "          }",
        "          {",
        '            const line = "passive";',
        "            log.value = [...log.value, line];",
        "          }",
        "        }}",
      ].join("\n"),
    );
    expect(contents).toContain("const save = $(async () => {");
    expect(contents).toContain(
      [
        "onSubmit$={(_, element) => {",
        "          void save();",
        "          if (!onceSubmit.has(element)) {",
      ].join("\n"),
    );
    expect(contents).not.toContain("void (async");
  });

  it("runs a merged listener that returns early under its guards' negation, or as a local function", async () => {
    const contents = await emitSource(
      source(
        "ref, defineEmits",
        `export function Saves() {
  const emit = defineEmits<{ saved: [count: number]; firstSave: [] }>();
  const tags = ref<string[]>([]);
  const saves = ref(0);
  return (
    <section>
      <button type="button"
        onClick={() => { if (tags.value.length === 0) return; saves.value += 1; emit("saved", saves.value); }}
        onClickOnce={() => emit("firstSave")}>Save</button>
      <button type="button"
        onClick={() => { if (tags.value.length > 1) { saves.value = 0; return; } emit("saved", saves.value); }}
        onClickOnce={() => emit("firstSave")}>Reset</button>
    </section>
  );
}`,
      ),
    );
    expect(contents).toContain(
      [
        "onClick$={(_, element) => {",
        "          if (tags.value.length !== 0) {",
        "            saves.value += 1;",
        "            onSaved$?.(saves.value);",
        "          }",
      ].join("\n"),
    );
    expect(contents).toContain("const listener = () => {");
    expect(contents).toContain("listener();");
    expect(contents).not.toContain("})(");
  });
});

describe("qwik target: task order and async tasks (ADR-0048)", () => {
  it("keeps hooks and watchers in source order, moving up what they read that is declared later", async () => {
    const contents = await emitSource(
      source(
        "computed, defineEmits, onMounted, ref, watch",
        `export function Order() {
  const emit = defineEmits<{ seen: [text: string] }>();
  const count = ref(0);
  onMounted(() => {
    emit("seen", \`first \${describe()}\`);
  });
  onMounted(() => {
    emit("seen", "second");
  });
  watch(count, () => {
    emit("seen", describe());
  });
  watch(count, (value) => {
    emit("seen", \`\${value}\`);
  });
  const doubled = computed(() => count.value * 2);
  function describe(): string {
    return \`doubled \${doubled.value}\`;
  }
  return <button type="button" onClick={() => (count.value += 1)}>{count.value}</button>;
}`,
      ),
    );
    // The tasks run in the order Qwik registers them; a call in a task runs in place, so the
    // emit after it is not left behind the next task's.
    const first = contents.indexOf("onSeen$?.(`first ${describe()}`);");
    const second = contents.indexOf('onSeen$?.("second");');
    const watcher = contents.indexOf("onSeen$?.(describe());");
    const last = contents.indexOf("onSeen$?.(`${value}`);");
    expect(contents.indexOf("const doubled = useComputed$")).toBeLessThan(first);
    expect([first, second, watcher, last]).toEqual(
      [first, second, watcher, last].toSorted((a, b) => a - b),
    );
    expect(first).toBeGreaterThan(-1);
    expect(contents).not.toContain("await describe()");
    expect(contents).not.toContain("const describe = $");
  });

  it("lets an async watcher's and watchEffect's body go on by itself, so a change reruns them at once", async () => {
    const contents = await emitSource(
      source(
        "defineEmits, ref, watch, watchEffect",
        `export function Lookup() {
  const emit = defineEmits<{ dropped: [query: string] }>();
  const query = ref("");
  const result = ref("");
  watch(query, async (value, previous, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
      emit("dropped", value);
    });
    const text = await new Promise<string>((resolve) => setTimeout(() => resolve(value), 10));
    if (!cancelled) result.value = text;
  });
  watchEffect(async (onCleanup) => {
    const current = query.value;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    await Promise.resolve();
    if (!cancelled) result.value = current;
  });
  return <input aria-label="Query" onInput={(event) => (query.value = (event.target as HTMLInputElement).value)} />;
}`,
      ),
    );
    // Qwik runs a task again only once its last run has settled (core \`runTask\`).
    expect(contents).not.toMatch(/useTask\$\(\s*async/);
    expect(contents).not.toMatch(/useVisibleTask\$\(\s*async/);
    expect(contents).toContain(
      "const onCleanup = (callback: () => void) => void queryCleanups?.push(callback);\n      void (async () => {\n        let cancelled = false;",
    );
    // The effect's cleanups wait in a list for its next run and for the unmount, as a watcher's.
    expect(contents).toContain(
      "const onCleanup = (callback: () => void) => void effectCleanups?.push(callback);\n      void (async () => {\n        const current = query.value;",
    );
    expect(contents).toContain(
      "for (const callback of effectCleanups?.splice(0) ?? []) callback();\n      });",
    );
  });

  it("registers onUnmounted's task after every other, so the cleanups run before the hook", async () => {
    const contents = await emitSource(
      source(
        "defineEmits, onUnmounted, ref, watchEffect",
        `export function Teardown() {
  const emit = defineEmits<{ unmounted: []; cleaned: [query: string] }>();
  const query = ref("");
  onUnmounted(() => {
    emit("unmounted");
  });
  watchEffect((onCleanup) => {
    const value = query.value;
    onCleanup(() => emit("cleaned", value));
  });
  return <input aria-label="Query" onInput={(event) => (query.value = (event.target as HTMLInputElement).value)} />;
}`,
      ),
    );
    expect(contents.indexOf("onUnmounted$?.()")).toBeGreaterThan(
      contents.lastIndexOf("effectCleanups?.splice(0)"),
    );
  });
});

describe("qwik target: controls at the top of a listener only (ADR-0047)", () => {
  it("keeps a listener of a control that is all its handler does: the marker beside a sync$", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Bare() {
  const count = ref(0);
  return (
    <div>
      <form aria-label="Quick" onSubmit={(event) => event.preventDefault()}><button type="submit">Send</button></form>
      <button type="button" onMousedown={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={() => (count.value += 1)}>Bold {count.value}</button>
    </div>
  );
}`,
      ),
    );
    // Qwik's loader listens only to the events some element has a handler of.
    expect(contents).toContain(
      '<form\n        aria-label="Quick"\n        preventdefault:submit\n        onSubmit$={sync$((event: SubmitEvent) => {\n          event.preventDefault();\n        })}\n      >',
    );
    expect(contents).toContain(
      "preventdefault:mousedown\n        stoppropagation:mousedown\n        onMouseDown$={sync$((event: MouseEvent) => {\n          event.preventDefault();\n          event.stopPropagation();\n        })}",
    );
  });

  it("lifts a call's controls through void, && and ?:", async () => {
    const written = source(
      "ref",
      `export function Forms() {
  const saving = ref(false);
  async function save(event: SubmitEvent) {
    event.preventDefault();
    saving.value = true;
    await new Promise((resolve) => setTimeout(resolve, 10));
    saving.value = false;
  }
  function dismiss(event: MouseEvent) {
    event.stopPropagation();
    saving.value = false;
  }
  function start() {
    saving.value = true;
  }
  return (
    <div>
      <form aria-label="A" onSubmit={(event) => void save(event)}><button type="submit">A</button></form>
      <form aria-label="B" onSubmit={(event) => event.submitter !== null && save(event)}><button type="submit">B</button></form>
      <button type="button" onClick={(event) => (event.altKey ? dismiss(event) : start())}>C</button>
      <p>{saving.value ? "saving" : "idle"}</p>
    </div>
  );
}`,
    );
    expect(requiredCapabilities(lower(written)).has("conditional-event-control")).toBe(false);
    const contents = await emitSource(written);
    expect(contents).toContain(
      '<form aria-label="A" preventdefault:submit onSubmit$={(event) => void save(event)}>',
    );
    expect(contents).toContain(
      "onSubmit$={[\n          sync$((event: SubmitEvent) => {\n            if (event.submitter !== null) {\n              event.preventDefault();\n            }\n          }),",
    );
    expect(contents).toContain(
      "onClick$={[\n          sync$((event: PointerEvent) => {\n            if (event.altKey) {\n              event.stopPropagation();\n            }\n          }),",
    );
  });

  it("drops a helper that is only a control, with the statements that only call it", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Helpers() {
  const count = ref(0);
  const cancel = (event: Event) => event.preventDefault();
  function guard(event: KeyboardEvent) {
    cancel(event);
  }
  return (
    <div>
      <a href="#a" onClick={(event) => { cancel(event); count.value += 1; }}>A {count.value}</a>
      <input aria-label="B" onKeydown={(event) => { if (event.key === "b") cancel(event); }} />
      <input aria-label="C" onKeydown={(event) => event.key === "c" && guard(event)} />
      <input aria-label="D" onKeydown={guard} />
    </div>
  );
}`,
      ),
    );
    expect(contents).not.toContain("cancel");
    expect(contents).not.toContain("guard");
    expect(contents).toContain(
      "preventdefault:click\n        onClick$={() => {\n          count.value += 1;\n        }}",
    );
    expect(contents).toContain(
      'aria-label="C"\n        onKeyDown$={sync$((event: KeyboardEvent) => {\n          if (event.key === "c") {\n            event.preventDefault();\n          }\n        })}',
    );
    expect(contents).toContain(
      'aria-label="D"\n        preventdefault:keydown\n        onKeyDown$={sync$((event: KeyboardEvent) => {\n          event.preventDefault();\n        })}',
    );
  });

  it("keeps a helper that is only a control where code still names it, with an empty body", async () => {
    const contents = await emitSource(
      source(
        "ref",
        `export function Kept() {
  const count = ref(0);
  const cancel = (event: Event) => event.preventDefault();
  function bump() {
    count.value += 1;
  }
  return <a href="#a" onClick={(event) => (event.altKey ? cancel(event) : bump())}>{count.value}</a>;
}`,
      ),
    );
    expect(contents).toContain("const cancel = (_event: Event) => {};");
  });

  it("types a sync$ with the listener's event, not a wider one its callee takes", async () => {
    const contents = await emitSource(
      source(
        "defineEmits",
        `export function Activate() {
  const emit = defineEmits<{ activated: [kind: string] }>();
  function activate(event: MouseEvent | KeyboardEvent) {
    event.preventDefault();
    emit("activated", event.type);
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") activate(event);
  }
  return <div role="button" tabindex="0" onClick={activate} onKeydown={onKeydown}>Go</div>;
}`,
      ),
    );
    expect(contents).toContain(
      'sync$((event: KeyboardEvent) => {\n          if (event.key === "Enter" || event.key === " ") {',
    );
  });

  it("declares a capture listener's control unsupported where an element listens in both phases", () => {
    const module = lower(
      source(
        "ref",
        `export function Phases() {
  const count = ref(0);
  return (
    <div role="presentation" onClickCapture={(event) => event.stopPropagation()} onClick={() => (count.value += 1)}>
      <p>{count.value}</p>
    </div>
  );
}`,
      ),
    );
    // Qwik runs that capture listener from the window, before the loader walks the path.
    expect(requiredCapabilities(module).has("conditional-event-control")).toBe(true);
  });

  it("declares a control after a guard on defaultPrevented, or after another statement, unsupported", () => {
    for (const handler of [
      "(event) => { if (event.defaultPrevented || event.button !== 0) return; event.preventDefault(); count.value += 1; }",
      "(event) => { count.value += 1; event.preventDefault(); }",
    ]) {
      const module = lower(
        source(
          "ref",
          `export function Link() {
  const count = ref(0);
  return <a href="#a" onClick={${handler}}>{count.value}</a>;
}`,
        ),
      );
      expect(requiredCapabilities(module).has("conditional-event-control")).toBe(true);
    }
  });

  it("declares a local function with a control that client code hands to addEventListener unsupported", () => {
    for (const registration of [
      'document.addEventListener("keydown", onShortcut);',
      'document.addEventListener("keydown", onShortcut as EventListener);',
      'document.addEventListener("keydown", (event) => onShortcut(event));',
    ]) {
      const module = lower(
        source(
          "onMounted, ref",
          `export function Shortcut() {
  const saves = ref(0);
  function onShortcut(event: KeyboardEvent) {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    saves.value += 1;
  }
  onMounted(() => {
    ${registration}
  });
  return <p>{saves.value}</p>;
}`,
        ),
      );
      expect(requiredCapabilities(module).has("conditional-event-control")).toBe(true);
    }
    expect(target.capabilities["conditional-event-control"]).toMatchObject({
      support: "unsupported",
      code: "UF4001",
      severity: "error",
    });
  });
});

describe("qwik target: functions client code adds as listeners, and template refs (ADR-0047, ADR-0049)", () => {
  const panel = source(
    "defineEmits, onMounted, onUnmounted, ref, useTemplateRef",
    `export function Panel() {
  const emit = defineEmits<{ closed: [reason: string] }>();
  const open = ref(false);
  const log = ref<string[]>([]);
  const handle = useTemplateRef<HTMLButtonElement>();
  let handleElement: HTMLButtonElement | null = null;
  function onKey(event: KeyboardEvent) {
    log.value = [...log.value, event.key];
  }
  function close(reason: string) {
    open.value = false;
    document.removeEventListener("keydown", onEscape);
    emit("closed", reason);
  }
  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape") close("escape");
  }
  function show() {
    open.value = true;
    document.addEventListener("keydown", onEscape);
  }
  function stop() {
    document.removeEventListener("keydown", onKey);
    handleElement?.removeEventListener("click", show);
  }
  onMounted(() => {
    handleElement = handle.value;
    handleElement?.addEventListener("click", show);
  });
  onUnmounted(() => stop());
  return (
    <section>
      <button type="button" ref={handle}>Show</button>
      <button type="button" onClick={() => document.addEventListener("keydown", onKey)}>Listen</button>
      <button type="button" onClick={() => document.removeEventListener("keydown", onKey)}>Stop</button>
      <p>{open.value ? "open" : "closed"} {log.value.join()}</p>
    </section>
  );
}`,
  );

  it("keeps one QRL for the instance's life of a function client code adds or removes", async () => {
    const contents = await emitSource(panel);
    // Qwik creates a component's QRLs again each time it renders it: the listener one handler
    // adds is the one another removes only once.
    expect(contents).toContain(
      "const onKey = useConstant(() =>\n    $((event: KeyboardEvent) => {",
    );
    expect(contents).toContain("const show = useConstant(() =>\n    $(() => {");
  });

  it("writes two functions that reference each other so both exist, through a holder", async () => {
    const contents = await emitSource(panel);
    expect(contents).toContain(
      "const functions = useConstant(() => ({}) as { onEscape: typeof onEscape });",
    );
    expect(contents).toContain('document.removeEventListener("keydown", functions.onEscape);');
    expect(contents).toContain(
      [
        "const onEscape = useConstant(() => {",
        "    const created = $(async (event: KeyboardEvent) => {",
        '      if (event.key === "Escape") await close("escape");',
        "    });",
        "    functions.onEscape = created;",
        "    return created;",
        "  });",
      ].join("\n"),
    );
    // `close` captures the holder, declared first, and `onEscape` captures `close`.
    expect(contents.indexOf("const functions")).toBeLessThan(contents.indexOf("const close"));
    expect(contents.indexOf("const close")).toBeLessThan(contents.indexOf("const onEscape"));
  });

  it("writes an expression-bodied onUnmounted callback's calls in place", async () => {
    const contents = await emitSource(panel);
    expect(contents).toContain(
      [
        "cleanup(() => {",
        '        document.removeEventListener("keydown", onKey);',
        '        handleElement.value?.removeEventListener("click", show);',
        "      });",
      ].join("\n"),
    );
  });

  it("reads a template ref's value that the source uses whole as T | null", async () => {
    const contents = await emitSource(panel);
    // Qwik's ref signal holds `undefined` where the source's template ref holds `null`.
    expect(contents).toContain("handleElement.value = handle.value ?? null;");
    const reads = await emitSource(
      source(
        "onMounted, ref, useTemplateRef",
        `export function Reads() {
  const count = ref(0);
  const field = useTemplateRef<HTMLInputElement>();
  function describe(element: HTMLElement | null) {
    return element === null ? "none" : element.tagName;
  }
  onMounted(() => {
    if (field.value) field.value.focus();
    field.value?.select();
    count.value = describe(field.value).length;
  });
  return <input aria-label={String(count.value)} ref={field} />;
}`,
      ),
    );
    expect(reads).toContain("if (field.value) field.value.focus();\n      field.value?.select();");
    expect(reads).toContain("count.value = describe(field.value ?? null).length;");
  });
});
