import { ref } from "@uxfront/unframework";

import Picker from "./Picker.uf.tsx";
import { vMark, vTrace } from "./trace.uf.ts";

// A directive on each row a list renders, and on each element a scoped fill renders, whose value
// reads the row's item or the fill's props (ADR-0108): each element gets its own hooks with its
// own value. A row applies two such directives, another listens beside one, and another's value
// reads the component's state too.
export default function Menu() {
  const items = ref([
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ]);
  const prefix = ref("Open");
  const focused = ref(0);

  return (
    <section class="menu" aria-label="Menu">
      <ul aria-label="Items">
        {items.value.map((item) => (
          <li key={item.id} data-name={item.id} v-trace={item.label}>
            {item.label}
          </li>
        ))}
      </ul>
      <ul aria-label="Marked">
        {items.value.map((item) => (
          <li key={item.id} data-name={`both-${item.id}`} v-trace={item.label} v-mark={item.id}>
            {item.label}
          </li>
        ))}
      </ul>
      <div class="focus">
        {items.value.map((item) => (
          <button
            key={item.id}
            type="button"
            data-name={`focus-${item.id}`}
            onFocusin={() => focused.value++}
            v-trace={item.label}
          >
            Focus {item.label}
          </button>
        ))}
      </div>
      <output>{focused.value}</output>
      <ul aria-label="Prefixed">
        {items.value.map((item) => (
          <li
            key={item.id}
            data-name={`prefixed-${item.id}`}
            v-trace={`${prefix.value} ${item.label}`}
          >
            {item.label}
          </li>
        ))}
      </ul>
      <Picker>
        {{
          option: ({ option }) => (
            <span data-name={`option-${option.id}`} v-trace={option.label}>
              {option.label}
            </span>
          ),
        }}
      </Picker>
      <button
        type="button"
        onClick={() =>
          (items.value = items.value.map((item) =>
            item.id === "a" ? { id: "a", label: "Alpha 2" } : item,
          ))
        }
      >
        Rename first
      </button>
      <button type="button" onClick={() => (items.value = [...items.value].reverse())}>
        Reverse
      </button>
      <button
        type="button"
        onClick={() => (items.value = items.value.filter((item) => item.id !== "b"))}
      >
        Remove second
      </button>
      <button
        type="button"
        onClick={() => (items.value = [...items.value, { id: "d", label: "Delta" }])}
      >
        Add item
      </button>
      <button type="button" onClick={() => (prefix.value = "Close")}>
        Change prefix
      </button>
    </section>
  );
}
