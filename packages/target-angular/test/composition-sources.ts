// Composition's forms the corpus does not reach, by component name: test/composition.test.ts
// checks what the emitter writes for each, and test/output.test.ts runs them through L3 to L5.

export const COMPOSITION_SOURCES: Readonly<Record<string, string>> = {
  // A select's options in a list and a group, their values bound, static or their text, with
  // no-break spaces at a text's edges and a label that may be `null`.
  Picker: `import { ref } from "unframework";
export default function Picker() {
  const choice = ref("b");
  const options = ref(["a", "b"]);
  const two = "y";
  const items = ref<{ id: number; label: string | null }[]>([{ id: 1, label: "One" }, { id: 2, label: null }]);
  return (
    <select v-model={choice.value}>
      {options.value.map((option) => <option key={option} value={option}>{option}</option>)}
      <optgroup label="More">
        <option value={two}>Two</option>
        <option>  Plain   text </option>
        {items.value.map((item) => <option key={item.id}> {item.label} </option>)}
        <option>&nbsp;&nbsp;Child</option>
        {items.value.map((item) => <option key={item.id}>&nbsp;{item.label}</option>)}
      </optgroup>
    </select>
  );
}
`,
  // A native v-model beside a listener of its event, before or after it, plain or once.
  Agree: `import { ref } from "unframework";
export default function Agree() {
  const agreed = ref(false);
  const text = ref("");
  const picked = ref("a");
  const log = ref("");
  return (
    <div>
      <input type="checkbox" onChange={() => (log.value = "c:" + agreed.value)} v-model={agreed.value} />
      <input v-model={text.value} onInput={() => (log.value = "t:" + text.value)} />
      <input type="radio" value="a" onChangeOnce={() => (log.value = "r:" + picked.value)} v-model={picked.value} />
      <p>{log.value}</p>
    </div>
  );
}
`,
  // Bindings named like the members composition declares, and a loop's item called `template`.
  Names: `import { defineSlots, ref } from "unframework";
import type { Element } from "unframework";
export default function Names() {
  const slots = defineSlots<{ title?(): Element; row?(props: { item: string }): Element }>();
  const style = ref("s");
  const titleTemplate = ref("x");
  const items = ref(["a"]);
  return (
    <div>
      <h2>{slots.title?.()}{style.value}{titleTemplate.value}</h2>
      {items.value.map((template) => <p key={template}>{slots.row?.({ item: template })}</p>)}
    </div>
  );
}
`,
  // A loop's item named like a slot's query, where the slot renders and is tested.
  Steps: `import { defineSlots } from "unframework";
import type { Element } from "unframework";
export default function Steps() {
  const slots = defineSlots<{ title?(): Element }>();
  return (
    <ul>
      {[1, 2].map((titleTemplate) => <li key={titleTemplate}>{slots.title?.()}{titleTemplate}</li>)}
      {slots.title ? <li>Titled</li> : null}
    </ul>
  );
}
`,
  // A slot named like another's context type, beside a local type named like its directive.
  Card: `import { defineSlots } from "unframework";
import type { Element } from "unframework";
type CardTitle = "h1" | "h2";
export default function Card({ level }: { level: CardTitle }) {
  const slots = defineSlots<{
    title?(props: { text: string }): Element;
    titleContext?(props: { text: string }): Element;
  }>();
  return (
    <section data-level={level}>
      {slots.title?.({ text: "a" })}
      {slots.titleContext?.({ text: "b" })}
    </section>
  );
}
`,
  // The same pair of slots, with no type.
  Tabs: `import { defineSlots } from "unframework";
import type { Element } from "unframework";
export default function Tabs() {
  const slots = defineSlots<{
    tab?(props: { text: string }): Element;
    tabContext?(props: { text: string }): Element;
  }>();
  return (
    <section>
      {slots.tab?.({ text: "a" })}
      {slots.tabContext?.({ text: "b" })}
    </section>
  );
}
`,
  // An event named like a helper the template calls.
  Chooser: `import { defineEmits, ref } from "unframework";
export default function Chooser() {
  const emit = defineEmits<{ selectedValues: [values: string[]] }>();
  const picked = ref<string[]>([]);
  return (
    <div>
      <select multiple v-model={picked.value} aria-label="Fruit">
        <option value="a">A</option>
        <option value="b">B</option>
      </select>
      <button type="button" onClick={() => emit("selectedValues", picked.value)}>Send</button>
    </div>
  );
}
`,
};

/**
 * Composed forms the corpus does not reach, by module: each module's components are files of
 * their own that import each other, so test/output.test.ts runs each module's files together.
 */
export const COMPOSED_SOURCES: Readonly<Record<string, string>> = {
  // Models whose bindings are named apart from them, one like a slot's query, each bound by a
  // consumer through the model's own name.
  Basket: `import { defineModel, defineSlots, ref } from "unframework";
import type { Element } from "unframework";
function Counter() {
  const count = defineModel<number>("value", { default: 0 });
  return <button type="button" onClick={() => (count.value = count.value + 1)}>{count.value}</button>;
}
function Panel() {
  const slots = defineSlots<{ title?(): Element }>();
  const titleTemplate = defineModel<boolean>("titleTemplate", { required: true });
  return (
    <section>
      {slots.title?.()}
      <button type="button" onClick={() => (titleTemplate.value = !titleTemplate.value)}>
        {titleTemplate.value ? "Open" : "Shut"}
      </button>
    </section>
  );
}
export default function Basket() {
  const items = ref(1);
  const open = ref(false);
  return (
    <div>
      <Counter v-model:value={items.value} />
      <Panel v-model:titleTemplate={open.value} />
    </div>
  );
}
`,
  // A model with no default, its binding named apart from it, bound by a consumer.
  Order: `import { defineModel, ref } from "unframework";
function Qty() {
  const amount = defineModel<number>("value");
  return <output>{amount.value ?? "None"}</output>;
}
export default function Order() {
  const n = ref(1);
  return <Qty v-model:value={n.value} />;
}
`,
  // A model with no type, no default and an alias, written by its component and bound by a
  // consumer.
  Score: `import { defineModel, ref } from "unframework";
function Tally() {
  const total = defineModel("count");
  return <button type="button" onClick={() => (total.value = 1)}>Set</button>;
}
export default function Score() {
  const n = ref<unknown>(0);
  return <Tally v-model:count={n.value} />;
}
`,
  // A key's owner filling a child's slot whose directive is named like the key.
  Shelf: `import { defineSlots, provide } from "unframework";
import type { Element, InjectionKey } from "unframework";
export const CardTitle: InjectionKey<string> = Symbol("uf.title");
function Card() {
  const slots = defineSlots<{ title?(): Element }>();
  return <article>{slots.title?.()}</article>;
}
export default function Shelf() {
  provide(CardTitle, "x");
  return <Card>{{ title: () => <em>Filled</em> }}</Card>;
}
`,
  // A slot whose directive is named like a child the component imports.
  Page: `import { defineSlots } from "unframework";
import type { Element } from "unframework";
function CardTitle() {
  return <h2>Title</h2>;
}
function Card() {
  const slots = defineSlots<{ title?(): Element }>();
  return (
    <article>
      <CardTitle />
      {slots.title?.()}
    </article>
  );
}
export default function Page() {
  return <Card>{{ title: () => <em>Filled</em> }}</Card>;
}
`,
};
