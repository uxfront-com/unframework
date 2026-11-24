import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface RowsSlots {
  row$?: QRL<() => JSXOutput>;
}

export default component$<
  RowsSlots &
    Omit<PropsOf<"div">, "row$" | "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ row$, class: className, style, ...attributes }) => {
  const items = useSignal([1, 2]);

  return (
    <div class={["rows", className]} style={style} {...attributes}>
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
});
