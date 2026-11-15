import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface RowsSlots {
  row$?: QRL<() => JSXOutput>;
}

export default component$<RowsSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ row$, class: className, style, ...attributes }) => {
    const items = useSignal([1, 2]);

    return (
      <div class={["rows", className]} {...scopeAttributes(attributes)} style={style}>
        <ul>
          {items.value.map((item) => (
            <li key={item}>{row$?.()}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick$={() => (items.value = [...items.value, items.value.length + 1])}
        >
          Add row
        </button>
        <button type="button" onClick$={() => (items.value = items.value.slice(0, -1))}>
          Remove row
        </button>
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
