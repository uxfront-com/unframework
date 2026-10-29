// Composition's shapes in Qwik (ADR-0053 to ADR-0055, ./src/composition.ts): what each construct
// emits. The corpus runs them through every layer; these pin the forms.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatOutput } from "@unframework/codegen";
import type { EmitContext } from "@unframework/codegen";
import { afterAll, describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { toolchain } from "../src/toolchain/index.ts";
import { emitSource, lower } from "./lower.ts";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const context = {
  toolchainDir: `${repo}tests/toolchains/qwik`,
  root: `${repo}tests/integration`,
};
/**
 * The timeout of a test that runs a checker (tsgo, oxlint or the optimizer): CI's `Unit tests`
 * is slower than the 5 s default, as for the other targets' L4 tests (./typecheck.test.ts).
 */
const CHECKED = 60_000;

// Scratch components live inside this package, so `@qwik.dev/core` resolves from them.
const scratchRoot = fileURLToPath(new URL("../.uf-tmp", import.meta.url));
mkdirSync(scratchRoot, { recursive: true });
const scratch = mkdtempSync(join(scratchRoot, "composition-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("qwik target: components and fallthrough", () => {
  it("merges a consumer's class and style after the root's own", async () => {
    const contents = await emitSource(
      `export default function Tag({ label }: { label: string }) {
  return <span class="tag" style={{ color: "red" }}>{label}</span>;
}`,
      { fallthrough: true },
    );
    expect(contents).toContain(
      "component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>",
    );
    expect(contents).toContain("({ label, class: className, style, ...attributes })");
    expect(contents).toContain(
      [
        "      <span",
        '        class={["tag", className]}',
        '        style={{ color: "red", ...style }}',
        "        {...scopeAttributes(attributes)}",
        "      >",
      ].join("\n"),
    );
  });

  it("writes a child's event as its QRL prop, and a function it names as a QRL", async () => {
    const contents = await emitSource(
      `import { defineEmits, ref } from "unframework";

export default function Form() {
  const cleared = ref("");
  function clear(label: string) {
    cleared.value = label;
  }
  return <section><Field onClear={clear} /><output>{cleared.value}</output></section>;
}

function Field() {
  const emit = defineEmits<{ clear: [label: string] }>();
  return <button type="button" onClick={() => emit("clear", "x")}>Clear</button>;
}`,
    );
    expect(contents).toContain('import { Field } from "./Field";');
    expect(contents).toContain("const clear = $((label: string) => {");
    expect(contents).toContain("<Field onClear$={clear} />");
  });
});

describe("qwik target: slots", () => {
  it("projects the default slot and renders any other as a QRL render prop", async () => {
    const contents = await emitSource(
      `import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Card() {
  const slots = defineSlots<{ default?(): Element; title?(): Element; item?(props: { n: number }): Element }>();
  return (
    <div>
      {slots.title?.() ?? "Untitled"}
      {slots.title ? <hr /> : null}
      {slots.item?.({ n: 1 })}
      {slots.default?.() ?? <p>Empty</p>}
    </div>
  );
}`,
    );
    expect(contents).toContain("export interface CardSlots {");
    expect(contents).toContain("title$?: QRL<() => JSXOutput>;");
    expect(contents).toContain("item$?: QRL<(props: { n: number }) => JSXOutput>;");
    expect(contents).toContain('{title$?.() ?? "Untitled"}');
    expect(contents).toContain("{title$ ? <hr /> : null}");
    expect(contents).toContain("{item$?.({ n: 1 })}");
    expect(contents).toContain("<Slot>\n");
  });
});

describe("qwik target: models", () => {
  it("reads a model through a computed of its prop or local signal, and writes it through a setter", async () => {
    const contents = await emitSource(
      `import { defineModel } from "unframework";

export default function Toggle() {
  const open = defineModel<boolean>("open", { default: false });
  return <button type="button" onClick={() => (open.value = !open.value)}>{open.value ? "On" : "Off"}</button>;
}`,
    );
    expect(contents).toContain("export interface ToggleModels {");
    expect(contents).toContain("onOpenChange$?: QRL<(open: boolean) => void>;");
    expect(contents).toContain("({ open: openProp, onOpenChange$ })");
    expect(contents).toContain("const openLocal = useSignal<boolean>(false);");
    expect(contents).toContain(
      "const open = useComputed$(() => (openProp === undefined ? openLocal.value : openProp));",
    );
    expect(contents).toContain("if (openProp === undefined) openLocal.value = next;");
    expect(contents).toContain("await onOpenChange$?.(next);");
    expect(contents).toContain("onClick$={() => setOpen(!open.value)}");
  });

  it("reads a control's model in render, so Qwik sets the property", async () => {
    const contents = await emitSource(
      `import { ref } from "unframework";

export default function Search() {
  const query = ref("");
  const weight = ref(0);
  return <form><input v-model={query.value} /><input v-model_number={weight.value} /></form>;
}`,
    );
    expect(contents).toContain("const currentQuery = query.value;");
    expect(contents).toContain(
      "<input value={currentQuery} onInput$={(_, element) => (query.value = element.value)} />",
    );
    expect(contents).toContain("const weightInput = useSignal<HTMLInputElement>();");
    expect(contents).toContain(
      "value={modelText.shown(weightInput.value, currentWeight, { number: true })}",
    );
    expect(contents).toContain("(weight.value = modelText.read(element, { number: true }))");
  });
});

describe("qwik target: replaced nodes", () => {
  it("puts a conditional a sibling follows in a fragment of its own", async () => {
    const contents = await emitSource(
      `import { ref } from "unframework";

export default function Swap() {
  const on = ref(false);
  return (
    <div>
      {on.value ? <h2>On</h2> : <p>Off</p>}
      <button type="button" onClick={() => (on.value = !on.value)}>Toggle</button>
      {on.value ? <em>Last</em> : null}
    </div>
  );
}`,
    );
    expect(contents).toContain("<>{on.value ? <h2>On</h2> : <p>Off</p>}</>");
    expect(contents).toContain("{on.value ? <em>Last</em> : null}");
    expect(contents).not.toContain("<>{on.value ? <em>Last</em> : null}</>");
  });
});

describe("qwik target: expose and context", () => {
  it("fills the consumer's ref with the exposed QRLs once in the document", async () => {
    const contents = await emitSource(
      `import { defineExpose, ref } from "unframework";

export default function Counter() {
  const count = ref(0);
  function reset() {
    count.value = 0;
  }
  defineExpose({ reset });
  return <output>{count.value}</output>;
}`,
    );
    expect(contents).toContain("ref?: Signal<object | undefined>");
    expect(contents).toContain("const reset = $(() => {");
    // Filled as it renders, so a consumer's `onMounted` finds it; emptied as it goes.
    expect(contents).toContain("useTask$(() => {\n    exposeRef(ref, { reset });");
    expect(contents).toContain("cleanup(() => exposeRef(ref, undefined));");
    expect(contents).toContain("function exposeRef(");
  });

  it("declares a key as a context id, and provides it", async () => {
    const contents = await emitSource(
      `import { provide, ref } from "unframework";
import type { InjectionKey, Ref } from "unframework";

export const CountKey: InjectionKey<Ref<number>> = Symbol("uf.count");

export default function Counter() {
  const count = ref(1);
  provide(CountKey, count);
  return <output>{count.value}</output>;
}`,
    );
    expect(contents).toContain(
      'export const CountKey = createContextId<Signal<number>>("uf.count");',
    );
    expect(contents).toContain("useContextProvider(CountKey, count);");
  });

  it("injects a key from its module's main component, undefined without a fallback", async () => {
    const contents = await emitSource(
      `import { inject, provide } from "unframework";
import type { InjectionKey } from "unframework";

export const LabelKey: InjectionKey<string> = Symbol("uf.label");

function Label() {
  const label = inject(LabelKey);
  return <span>{label ?? "none"}</span>;
}

export default function Labelled() {
  provide(LabelKey, "Name");
  return <Label />;
}`,
    );
    expect(contents).toContain('import { LabelKey } from "./Labelled";');
    // Qwik throws for an `undefined` default, and calls a function one with what is provided.
    expect(contents).toContain("const label = useContext(LabelKey, (provided?) => provided);");
  });
});

describe("qwik target: render callbacks", () => {
  it("declares a `<component is>` that reads a list's item in the list's callback", async () => {
    const contents = await emitSource(
      `export default function Blocks({ items }: { items: { id: string; tag: "h2" | "p"; text: string }[] }) {
  return (
    <div>
      {items.map((item) => (
        <section key={item.id}>
          <component is={item.tag} class="block">{item.text}</component>
        </section>
      ))}
    </div>
  );
}`,
    );
    expect(contents).toContain("({ items }) => {\n    return (");
    expect(contents).toContain("{items.map((item) => {\n          const Tag = item.tag;");
  });

  it("declares a setup function a fill calls in the fill, so the fill renders at once", async () => {
    const contents = await emitSource(
      `import { defineSlots, ref } from "unframework";
import type { Element } from "unframework";

export default function Names() {
  const prefix = ref("Dr ");
  function format(name: string) {
    return prefix.value + name;
  }
  function ok(name: string) {
    return name.length > prefix.value.length;
  }
  return (
    <List>
      {{
        item: ({ item }) => (
          <b class={{ on: ok(item) }} style={{ color: format(item) }}>
            {format(item).toUpperCase()}
            {ok(item) ? <i>long</i> : null}
          </b>
        ),
        group: ({ items }) => (
          <ul>
            {items.map((each) => (
              <li key={each}>{format(each).toUpperCase()}</li>
            ))}
          </ul>
        ),
      }}
    </List>
  );
}

function List() {
  const slots = defineSlots<{
    item?(props: { item: string }): Element;
    group?(props: { items: string[] }): Element;
  }>();
  return (
    <div>
      {slots.item?.({ item: "Ada" })}
      {slots.group?.({ items: ["Ada"] })}
    </div>
  );
}`,
    );
    // A `$` scope captures no plain function (optimizer C02), and a QRL's call is a promise until
    // it loads: each fill declares what it calls, written in place, and nothing is awaited.
    expect(contents).not.toContain("$((name: string)");
    expect(contents).not.toContain("await");
    expect(contents).not.toContain("async");
    expect(contents).toContain(
      "item$={({ item }) => {\n          function ok(name: string) {\n            return name.length > prefix.value.length;\n          }\n          function format(",
    );
    expect(contents).toContain(
      "function format(name: string) {\n            return prefix.value + name;",
    );
    expect(contents).toContain(
      "<b class={{ on: Boolean(ok(item)) }} style={{ color: format(item) }}>",
    );
    expect(contents).toContain("{format(each).toUpperCase()}");
    expect(contents.match(/function format\(/g)).toHaveLength(2);
  });

  it("declares a `<component is>` in a list inside a fill in the list's callback", async () => {
    // A fill's own props cannot name the candidates: the analyser reports UF3044 for them.
    const contents = await emitSource(
      `import { defineSlots } from "unframework";
import type { Element } from "unframework";

export interface Cell {
  id: string;
  tag: "h2" | "p";
}

export default function Page({ cells }: { cells: Cell[] }) {
  return (
    <Row>
      {{ cell: () => <div>{cells.map((cell) => <section key={cell.id}><component is={cell.tag}>Cell</component></section>)}</div> }}
    </Row>
  );
}

function Row() {
  const slots = defineSlots<{ cell?(): Element }>();
  return <div>{slots.cell?.()}</div>;
}`,
    );
    expect(contents).toContain("{cells.map((cell) => {\n");
    expect(contents).toContain("const Tag = cell.tag;");
    expect(contents).not.toMatch(/=> \{\n {4}const Tag/);
  });

  it("selects an option without a value by its text", async () => {
    const contents = await emitSource(
      `import { ref } from "unframework";

export default function Pick() {
  const letter = ref("b");
  return <select v-model={letter.value}><option>a</option><option>b</option></select>;
}`,
    );
    expect(contents).toContain('<option selected={currentLetter === "a"}>a</option>');
    expect(contents).toContain('<option selected={currentLetter === "b"}>b</option>');
  });

  it("selects an option by the text its expressions render, as the DOM reads it", async () => {
    const contents = await emitSource(
      `import { ref } from "unframework";

export default function Pick({ sizes, label }: { sizes: number[]; label: string }) {
  const size = ref("2");
  return (
    <select v-model={size.value}>
      {sizes.map((n) => (
        <option key={n}>{n}</option>
      ))}
      <option> {label}! </option>
    </select>
  );
}`,
    );
    const read = '.replace(/[\\t\\n\\f\\r ]+/g, " ").replace(/^ | $/g, "")';
    expect(contents).toContain(`currentSize === \`\${n ?? ""}\`${read}`);
    expect(contents).toContain(`currentSize === \` \${label ?? ""}! \`${read}`);
  });
});

describe("qwik target: fallthrough to a component root", () => {
  it("passes a consumer's class and style on to the root component", async () => {
    const contents = await emitSource(
      `export default function Primary({ text }: { text: string }) {
  return <Base text={text} class="primary" />;
}

function Base({ text }: { text: string }) {
  return <button type="button" class="base">{text}</button>;
}`,
      { fallthrough: true },
    );
    expect(contents).toContain(
      [
        "        <Base",
        "          text={text}",
        '          class={["primary", className]}',
        "          {...scopeAttributes(attributes)}",
        "          style={style}",
        "        />",
      ].join("\n"),
    );
  });
});

describe("qwik target: fills, listeners and the optimizer", () => {
  const board = `import { defineSlots, ref } from "unframework";
import type { Element } from "unframework";

export default function Board() {
  const chosen = ref("none");
  function choose(name: string) {
    chosen.value = name;
  }
  function label(name: string) {
    return name === chosen.value ? \`[\${name}]\` : name;
  }
  function tagOf(name: string): "b" | "i" {
    return name === chosen.value ? "b" : "i";
  }
  return (
    <Groups>
      {{
        group: ({ items }) => (
          <ul>
            {items.map((name) => (
              <li key={name}>
                <button type="button" onClick={() => choose(name)}>
                  Pick {label(name)}
                </button>
                <button type="button" onClick={() => label(name)}>
                  {name.split("").map((c) => label(c)).join(",")}
                </button>
              </li>
            ))}
            <li>
              <component is={tagOf("Ada")}>Ada</component>
            </li>
          </ul>
        ),
      }}
    </Groups>
  );
}

function Groups() {
  const slots = defineSlots<{ group?(props: { items: string[] }): Element }>();
  return <div>{slots.group?.({ items: ["Ada"] })}</div>;
}`;

  it("names a fill's copy apart from the QRL a listener in the fill calls", async () => {
    const contents = await emitSource(board);
    expect(contents).toContain("const label = $((name: string) => {");
    expect(contents).toContain("function labelInFill(name: string) {");
    expect(contents).toContain("Pick {labelInFill(name)}");
    expect(contents).toContain(".map((c) => labelInFill(c))");
    expect(contents).toContain("onClick$={$(() => label(name))}");
  });

  it("writes a listener in a list in a fill `$(…)`, and the optimizer accepts the fill", async () => {
    const contents = await emitSource(board);
    expect(contents).toContain("onClick$={$(() => choose(name))}");
    expect(contents).toContain('const Tag = tagOf("Ada");');
    expect(contents).not.toMatch(/=> \{\n {4}const Tag/);
    const file = { path: "/virtual/Board.tsx", contents };
    const result = (await toolchain.frameworkCompile([file], context)).get(file.path);
    expect(result).toEqual({ errors: [], warnings: [] });
  });

  const spelled = `import { defineSlots, ref } from "unframework";
import type { Element } from "unframework";

export default function Spelled() {
  const mark = ref("*");
  function format(c: string) {
    return mark.value + c;
  }
  return <Rows>{{ item: ({ item }) => <b>{item.split("").map((c) => format(c)).join(",")}</b> }}</Rows>;
}

function Rows() {
  const slots = defineSlots<{ item?(props: { item: string }): Element }>();
  return <ul><li>{slots.item?.({ item: "Ada" })}</li></ul>;
}`;

  it("declares no QRL for a function only a fill's callback calls", async () => {
    const contents = await emitSource(spelled);
    expect(contents).not.toContain("$((c: string)");
    expect(contents).toContain("function format(c: string) {");
    expect(contents).toContain(".map((c) => format(c))");
  });

  it(
    "emits fills that type-check and lint clean (L4, L5)",
    async () => {
      await expectCheckedClean([board, spelled]);
    },
    CHECKED,
  );
});

describe("qwik target: generic components", () => {
  // ADR-0068: a generic arrow in `component$`, which TypeScript makes a generic component, and
  // the interfaces beside it over the type parameters their members read.
  const pick = `import { computed, defineEmits, defineExpose, defineModel, defineSlots } from "unframework";
import type { Element } from "unframework";

export type PickEvents = "taken";

export interface PickProps<T extends { id: string }, U extends string = "x"> {
  items: T[];
  note?: U;
}

export default function Pick<T extends { id: string }, U extends string = "x">({ items, note }: PickProps<T, U>) {
  const emit = defineEmits<{ pick: [item: T] }>();
  const first = computed(() => (items[0] ? label(items[0]) : ""));
  const open = defineModel<boolean>("open");
  const slots = defineSlots<{ item?(props: { item: T }): Element }>();
  const empty: T[] = [];
  function label(item: T): string {
    return item.id;
  }
  function choose(item: T) {
    emit("pick", item);
  }
  defineExpose({ choose });
  return (
    <ul data-note={note} data-open={String(open.value)} data-first={first.value}>
      {(items.length ? items : empty).map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => choose(item)}>{label(item)}</button>
          {slots.item?.({ item })}
        </li>
      ))}
    </ul>
  );
}`;
  const multi = `import { defineModel, ref } from "unframework";

export default function Multi<T extends string>({ options }: { options: readonly T[] }) {
  const picked = ref<T[]>([]);
  const text = defineModel<T>("text", { required: true });
  const trimmed = defineModel<T>("trimmed", { required: true });
  return (
    <div>
      <input v-model_trim={trimmed.value} />
      <output>{picked.value.join(",")}</output>
      <select multiple v-model={picked.value}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <input v-model={text.value} />
    </div>
  );
}`;
  const unread = `export default function Unread<T>(props: { items: T[] }) {
  return <p>none</p>;
}`;
  // Functions whose parameters' types name `T`, in each declared form: they move to module scope
  // with their own `T`, so a getter may call them, and each call infers it.
  const hoisted = `import { computed, ref } from "unframework";

export default function Hoisted<T>({ items }: { items: T[] }) {
  const last = ref("");
  function size(list: T[]): number {
    return list.length;
  }
  const show = (item: T) => String(item);
  const settle = async (item: T) => [item];
  async function keep(item: T): Promise<T[]> {
    return [item];
  }
  const total = computed(() => size(items) + 1);
  async function pick(item: T) {
    last.value = String((await settle(item)).length + (await keep(item)).length);
  }
  return (
    <ul data-total={total.value} data-last={last.value}>
      {items.map((item, index) => (
        <li key={index}>
          <button type="button" onClick={() => pick(item)}>{show(item)}</button>
        </li>
      ))}
    </ul>
  );
}`;
  // A forward chain of constraints (`A extends Box<B>, B extends Box<C>, C`): each interface and
  // hoisted function declares all three.
  const chain = `import { defineEmits } from "unframework";

interface Box<V> {
  value: V;
}

export interface ChainProps<A extends Box<B>, B extends Box<C>, C> {
  items: A[];
  extra?: B;
  last?: C;
}

export default function Chain<A extends Box<B>, B extends Box<C>, C>({ items }: ChainProps<A, B, C>) {
  const emit = defineEmits<{ pick: [item: A] }>();
  function label(item: A): string {
    return String(item.value);
  }
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>
          <button type="button" onClick={() => emit("pick", item)}>{label(item)}</button>
        </li>
      ))}
    </ul>
  );
}`;
  // The same chain in the other order: a single pass in declared order misses a parameter here,
  // as a reversed one does in `chain`.
  const reversedChain = chain
    .replaceAll("A extends Box<B>, B extends Box<C>, C", "C, B extends Box<C>, A extends Box<B>")
    .replaceAll("ChainProps<A, B, C>", "ChainProps<C, B, A>");
  // Functions kept in the generic arrow, which getters call: a `computed`'s, and a watcher's
  // sources, alone and in an array.
  const kept = `import { computed, ref, watch } from "unframework";

export default function Kept<T>({ items }: { items: T[] }) {
  const nothing: T[] = [];
  const last = ref("");
  function count() {
    return nothing.length;
  }
  function blank(): T[] {
    return [];
  }
  function wrap() {
    return blank().length;
  }
  function deep(): T[] {
    return [];
  }
  function shallow() {
    return deep().length;
  }
  function inner(): T[] {
    return [];
  }
  function outer() {
    return inner().length;
  }
  function guard(value: unknown): void {
    if (value === nothing) throw new Error("empty");
  }
  function check(value: unknown): asserts value is T[] {
    if (!Array.isArray(value)) throw new Error("not a list");
  }
  const total = computed(() => count() + blank().length + items.length);
  const deepest = computed(() => shallow());
  const checked = computed(() => {
    const value: unknown = items;
    guard(value);
    check(value);
    return value.length + inner().length;
  });
  watch(
    () => wrap() + items.length,
    (size) => {
      last.value = String(size);
    },
  );
  watch([() => count(), () => items.length], ([counted, length]) => {
    last.value = String(counted + length);
  });
  return (
    <p data-last={last.value} data-blank={blank().length} data-outer={outer()}>
      {total.value} {checked.value} {deepest.value}
    </p>
  );
}`;
  // A function whose `T` only its return type names, which reads nothing of the component.
  const first = `import { defineEmits } from "unframework";

export default function First<T>({ items }: { items: T[] }) {
  const emit = defineEmits<{ pick: [item: T] }>();
  function none(): T | undefined {
    return undefined;
  }
  function pick() {
    const found = none();
    if (found !== undefined) emit("pick", found);
  }
  return <button type="button" data-count={items.length} onClick={pick}>Pick</button>;
}`;
  // Types the module imports and re-exports keep their names: the interfaces take others.
  const named = `import { defineEmits, defineSlots } from "unframework";
import type { Element } from "unframework";
import type { ListEvents } from "./types";

export type { ListSlots } from "./types";

export default function List<T>({ items }: { items: T[] }) {
  const emit = defineEmits<{ pick: [item: T] }>();
  const slots = defineSlots<{ item?(props: { item: T }): Element }>();
  const seen: ListEvents = [];
  return (
    <ul data-seen={seen.length}>
      {items.map((item, index) => (
        <li key={index}>
          <button type="button" onClick={() => emit("pick", item)}>{slots.item?.({ item })}</button>
        </li>
      ))}
    </ul>
  );
}`;
  const types = 'export type ListEvents = string[];\nexport type ListSlots = "item";\n';

  it("writes a generic arrow, and its interfaces over the parameters they read", async () => {
    const contents = await emitSource(pick);
    expect(contents).toContain(
      "export interface PickEvents_1<T extends { id: string }> {\n  onPick$?: QRL<(item: T) => void>;\n}",
    );
    expect(contents).toContain("export interface PickModels {");
    expect(contents).toContain("export interface PickSlots<T extends { id: string }> {");
    expect(contents).toMatch(
      /export default component\$\(\n {2}<T extends \{ id: string \}, U extends string = "x">\(\{/,
    );
    // `PickEvents` is the source's own exported type (ADR-0068): the interface takes another name.
    expect(contents).toContain(
      "}: PickProps<T, U> &\n    PickEvents_1<T> &\n    PickModels &\n    PickSlots<T> & { ref?: Signal<object | undefined> }) => {",
    );
    // A constant `T` types stays in the arrow, where `T` is in scope; a function `T` types moves
    // to module scope with its own `T`, so the computed's `$` scope can call it.
    expect(contents).toMatch(/=> \{\n(?:.*\n)*? {4}const empty: T\[\] = \[\];/);
    expect(contents).toMatch(/^function label<T extends \{ id: string \}>\(item: T\): string \{$/m);
  });

  it("writes a control's value as the type of the generic state or model it binds", async () => {
    const contents = await emitSource(multi);
    expect(contents).toContain("picked.value = selectedValues(element) as T[]");
    expect(contents).toContain("setText(element.value as T)");
    // A modifier reads the control through `modelText`, whose value is cast the same way.
    expect(contents).toContain("setTrimmed(modelText.read(element, { trim: true }) as T)");
  });

  it("moves a function typed by `T` to module scope with its own `T`, in each declared form", async () => {
    const contents = await emitSource(hoisted);
    expect(contents).toMatch(/^function size<T>\(list: T\[\]\): number \{$/m);
    // An arrow's lone `<T>` takes a comma, or TSX reads it as a tag.
    expect(contents).toMatch(/^const show = <T,>\(item: T\) => String\(item\);$/m);
    expect(contents).toMatch(/^const settle = async <T,>\(item: T\) => \[item\];$/m);
    expect(contents).toMatch(/^async function keep<T>\(item: T\): Promise<T\[\]> \{$/m);
    expect(contents).toContain("useComputed$(() => size(items) + 1)");
  });

  it("closes a parameter's constraints over the parameters they name, in either order", async () => {
    // The closure runs to a fixed point.
    const reversed = await emitSource(reversedChain);
    expect(reversed).toContain(
      "export interface ChainEvents<C, B extends Box<C>, A extends Box<B>> {",
    );
    const contents = await emitSource(chain);
    expect(contents).toContain(
      "export interface ChainEvents<A extends Box<B>, B extends Box<C>, C> {",
    );
    expect(contents).toMatch(
      /^function label<A extends Box<B>, B extends Box<C>, C>\(item: A\): string \{$/m,
    );
  });

  it("names its interfaces apart from the types the module imports and re-exports", async () => {
    const contents = await emitSource(named);
    expect(contents).toContain("export interface ListEvents_1<T> {");
    expect(contents).toContain("export interface ListSlots_1<T> {");
    expect(contents).toContain('import type { ListEvents } from "./types";');
    expect(contents).toContain('export type { ListSlots } from "./types";');
  });

  it("declares a function kept in the generic arrow inside each getter that calls it", async () => {
    const contents = await emitSource(kept);
    // `blank` names a `T` no call could infer, `count` reads a constant typed by `T`, and `wrap`
    // calls `blank`: each stays in the arrow, and a getter's `$` scope can't capture a function.
    expect(contents).not.toMatch(/^(?:function|const) (?:blank|count|wrap)\b/m);
    expect(lines(contents)).toContain(
      lines(`const total = useComputed$(() => {
        function count() {
          return nothing.length;
        }
        function blank(): T[] {
          return [];
        }
        return count() + blank().length + items.length;
      });`),
    );
    // `wrap` declares the `blank` it calls in itself.
    expect(lines(contents)).toContain(
      lines(`function wrap() {
          function blank(): T[] {
            return [];
          }
          return blank().length;
        }`),
    );
    // A watcher's getter source, alone or among an array's, does the same.
    expect(lines(contents)).toContain(
      lines(`const sizeSource = useComputed$(() => {
        function wrap() {`),
    );
    expect(contents.match(/function count\(\) \{/g)).toHaveLength(2);
    // A statement call and an assertion stay calls, declared in the getter: an assertion's
    // narrowing needs its call by name (TS2776).
    expect(lines(contents)).toContain(
      lines(`guard(value);
        check(value);
        return value.length + inner().length;`),
    );
    expect(contents).toMatch(
      /useComputed\$\(\(\) => \{\n(?:.*\n)*? {4}function check\(value: unknown\): asserts value is T\[\] \{/,
    );
    // `outer`, which the template calls, calls `inner`: the arrow declares both, and the getter
    // that calls `inner` its own.
    expect(contents.match(/function inner\(\): T\[\] \{/g)).toHaveLength(2);
    // `deep`, which only `shallow` calls, which only a getter calls, is declared only there.
    expect(contents.match(/function deep\(\): T\[\] \{/g)).toHaveLength(1);
    // The template calls `blank` too, so the arrow declares it as well.
    expect(contents).toMatch(
      /=> \{\n {2}const nothing: T\[\] = \[\];\n(?:.*\n)*? {2}function blank\(\): T\[\] \{/,
    );
  });

  it("keeps a function no call could infer `T` for in the arrow, where its callers check", async () => {
    // A call with no contextual type would infer `unknown` from a module-scope `none<T>()`.
    const contents = await emitSource(first);
    expect(contents).not.toMatch(/^function none/m);
    expect(contents).toContain("  const none = $((): T | undefined => {");
  });

  it(
    "emits generic components the optimizer, the checker and lint accept (L3, L4, L5)",
    async () => {
      const sources = [pick, multi, unread, hoisted, chain, reversedChain, named, first, kept];
      for (const source of sources) {
        const contents = await emitSource(source);
        const file = { path: "/virtual/Generic.tsx", contents };
        const result = (await toolchain.frameworkCompile([file], context)).get(file.path);
        expect(result).toEqual({ errors: [], warnings: [] });
      }
      await expectCheckedClean(sources, { "types.ts": types });
    },
    CHECKED,
  );
});

describe("qwik target: options read as the DOM reads them", () => {
  const pick = `import { ref } from "unframework";

export default function Pick({ hint, sizes }: { hint?: string; sizes: string[] }) {
  const picked = ref("");
  const many = ref<string[]>([]);
  const count = ref(1);
  return (
    <div>
      <select v-model={picked.value}>
        <option>{hint}</option>
        <option>&nbsp;sp&nbsp;</option>
        <option>{hint ? "Yes" : "No"}</option>
        <option>{hint ? hint : undefined}</option>
        <option>{\`\${count.value + 1}\`}</option>
        <option>{hint ?? "none"}</option>
      </select>
      <select multiple v-model={many.value}>
        {sizes.map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}`;

  it("renders a nullish expression as no text, and keeps a non-ASCII space", async () => {
    const contents = await emitSource(pick);
    const read = '.replace(/[\\t\\n\\f\\r ]+/g, " ").replace(/^ | $/g, "")';
    expect(contents).toContain(`currentPicked === \`\${hint ?? ""}\`${read}`);
    // The DOM strips ASCII whitespace only.
    expect(contents).toContain('currentPicked === "\u00a0sp\u00a0"');
    // TypeScript rejects `?? ""` after what is never nullish (TS2869).
    expect(contents).toContain(`\`\${hint ? "Yes" : "No"}\`${read}`);
    expect(contents).toContain(`\`\${\`\${count.value + 1}\`}\`${read}`);
    // A conditional that may be nullish is in parentheses before `??`.
    expect(contents).toContain(`\`\${(hint ? hint : undefined) ?? ""}\`${read}`);
    expect(contents).toMatch(/currentMany\.includes\(\s*`\$\{n \?\? ""\}`/);
    // TypeScript reads `a ?? b` by `b`, which is never nullish here.
    expect(contents).toContain(`\`\${hint ?? "none"}\`${read}`);
  });

  it("renders an expression that is always nullish as no text, with no `??` (TS2871)", async () => {
    const contents = await emitSource(`import { ref } from "unframework";

export default function Pick({ hint }: { hint?: string }) {
  const picked = ref("");
  return (
    <select v-model={picked.value}>
      <option>A{hint ? null : undefined}</option>
      <option>{hint ?? null}</option>
    </select>
  );
}`);
    expect(contents).toContain("currentPicked === `A`.replace(");
    // TypeScript reads `hint ?? null` as always nullish, though `hint` may not be.
    expect(contents).toMatch(
      /currentPicked ===\s+`\$\{\[hint \?\? null\]\.join\(""\)\}`\.replace\(/,
    );
  });

  it(
    "emits options that type-check and lint clean (L4, L5)",
    async () => {
      await expectCheckedClean([pick]);
    },
    CHECKED,
  );
});

describe("qwik target: a `v-model` beside a listener of its event", () => {
  const fields = `import { ref } from "unframework";

export default function Fields() {
  const text = ref("");
  const on = ref(false);
  const size = ref("s");
  const count = ref(0);
  return (
    <div>
      <input aria-label="Name" onInput={() => count.value++} v-model={text.value} />
      <input type="checkbox" aria-label="On" v-model={on.value} onChange={() => count.value++} />
      <select aria-label="Size" v-model={size.value} onChange={() => count.value++}>
        <option value="s">S</option>
        <option value="m">M</option>
      </select>
      <p>{count.value}</p>
    </div>
  );
}`;

  it("runs the model's handler first, in the element's one prop of the event", async () => {
    const contents = await emitSource(fields);
    expect(contents.match(/onInput\$=/g)).toHaveLength(1);
    expect(contents.match(/onChange\$=/g)).toHaveLength(2);
    expect(contents).toContain(
      "onInput$={[$((_, element) => (text.value = element.value)), $(() => count.value++)]}",
    );
    expect(contents).toContain(
      "onChange$={[$((_, element) => (size.value = element.value)), $(() => count.value++)]}",
    );
  });

  it(
    "emits a model beside a listener that type-checks and lints clean (L4, L5)",
    async () => {
      await expectCheckedClean([fields]);
    },
    CHECKED,
  );
});

describe("qwik target: a `<component is>` with listeners", () => {
  const toggle = `import { ref } from "unframework";

export default function Toggle({ link }: { link: boolean }) {
  const count = ref(0);
  function bump() {
    count.value += 1;
  }
  return (
    <component is={link ? "a" : "button"} role="button" tabindex="0" onClick={bump} onKeydown={() => bump()}>
      Count {count.value}
    </component>
  );
}`;

  it("renders one tag per candidate, each with the listeners", async () => {
    const contents = await emitSource(toggle);
    expect(contents).toContain('const Tag = link ? "a" : "button";');
    expect(contents).toMatch(
      /Tag === "a" \? \(\s*<a role="button" tabIndex=\{0\} onClick\$=\{bump\}/,
    );
    expect(contents).toMatch(/\) : \(\s*<button role="button" tabIndex=\{0\} onClick\$=\{bump\}/);
    expect(contents.match(/onKeyDown\$=\{\(\) => bump\(\)\}/g)).toHaveLength(2);
    expect(contents).not.toContain("<Tag");
  });

  it("plans a tag's listeners as an element's: named, called, capture, control and emitting ones", async () => {
    const plain = await emitSource(listening("button", "button"));
    const dynamic = await emitSource(
      listening('component is={link ? "a" : "button"}', "component"),
    );
    const setup = (code: string) => lines(code.slice(0, code.indexOf("return (")));
    expect(setup(dynamic)).toBe(`${setup(plain)}\nconst Tag = link ? "a" : "button";`);
    const button = plain.slice(plain.indexOf("<button"), plain.indexOf("</button>") + 9);
    expect(lines(dynamic)).toContain(lines(button));
    expect(lines(dynamic)).toContain(
      lines(button).replace("<button", "<a").replace("</button>", "</a>"),
    );
  });

  it(
    "emits a `<component is>` with listeners that compiles, type-checks and lints clean",
    async () => {
      const file = { path: "/virtual/Toggle.tsx", contents: await emitSource(toggle) };
      const compiled = (await toolchain.frameworkCompile([file], context)).get(file.path);
      expect(compiled).toEqual({ errors: [], warnings: [] });
      await expectCheckedClean([toggle]);
    },
    CHECKED,
  );
});

/** A source whose tag, an element or a `<component is>`, holds every kind of listener. */
function listening(open: string, close: string): string {
  return `import { defineEmits, ref } from "unframework";

export default function Toggle({ link }: { link: boolean }) {
  const emit = defineEmits<{ pressed: [key: string] }>();
  const count = ref(0);
  // Only a listener names it: its control moves to the listener.
  function save(event: MouseEvent) {
    event.preventDefault();
    count.value += 1;
  }
  // A listener names it and another calls it: it keeps its control.
  function mark(event: MouseEvent) {
    event.preventDefault();
    count.value += 5;
  }
  // Empty once its control is lifted: the call goes, and so does the function.
  function prevent(event: KeyboardEvent) {
    event.preventDefault();
  }
  function step(n: number) {
    count.value += n;
  }
  return (
    <${open} role="button" tabindex="0" onClick={save} onDblclick={mark} onContextmenu={(event) => mark(event)} onClickCapture={() => step(2)} onKeydown={(event) => { prevent(event); emit("pressed", event.key); }}>
      {link ? "on" : "off"} {count.value}
    </${close}>
  );
}`;
}

/** Code's lines without their indentation, and without blank ones. */
function lines(code: string): string {
  return code
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Emits every component of each source, as the compiler does, and runs L4 and L5 on the
 * output: neither the target nor oxfmt may report anything, and no checker message, for these
 * files or any other path, may remain.
 */
async function expectCheckedClean(
  sources: readonly string[],
  modules: Readonly<Record<string, string>> = {},
): Promise<void> {
  const paths: string[] = [];
  for (const source of sources) {
    const dir = mkdtempSync(join(scratch, "checked-"));
    // The `.ts` modules a source imports, beside its outputs as in an output tree (ADR-0070).
    for (const [name, code] of Object.entries(modules)) writeFileSync(join(dir, name), code);
    const module = lower(source);
    const reported: unknown[] = [];
    for (const component of module.components) {
      const emit: EmitContext = {
        module,
        options: undefined,
        report: (diagnostic) => void reported.push(diagnostic),
      };
      for (const file of target.emit(component, emit)) {
        const formatted = await formatOutput(file);
        expect(formatted.error).toBeUndefined();
        const path = join(dir, formatted.file.path);
        writeFileSync(path, formatted.file.contents);
        paths.push(path);
      }
    }
    expect(reported).toEqual([]);
  }
  const [types, lint] = await Promise.all([
    toolchain.typecheck(paths, context),
    toolchain.lint(paths, context),
  ]);
  for (const results of [types, lint]) {
    for (const [path, messages] of results) expect(messages, path).toEqual([]);
    expect([...results.keys()].toSorted()).toEqual(paths.toSorted());
  }
}
