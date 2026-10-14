// Composition's forms the corpus does not reach, by component name: test/composition.test.ts
// checks what the emitter writes for each, and test/output.test.ts runs them through L3 to L5.

export const COMPOSITION_SOURCES: Readonly<Record<string, string>> = {
  // A select's options in a list and a group, their values bound, static or their text.
  Picker: `import { ref } from "unframework";
export default function Picker() {
  const choice = ref("b");
  const options = ref(["a", "b"]);
  const two = "y";
  const items = ref([{ id: 1, label: "One" }, { id: 2, label: "Two" }]);
  return (
    <select v-model={choice.value}>
      {options.value.map((option) => <option key={option} value={option}>{option}</option>)}
      <optgroup label="More">
        <option value={two}>Two</option>
        <option>  Plain   text </option>
        {items.value.map((item) => <option key={item.id}> {item.label} </option>)}
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
};
