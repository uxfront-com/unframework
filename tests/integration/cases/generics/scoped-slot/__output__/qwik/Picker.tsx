import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface PickerProps<T> {
  items: T[];
}

export interface PickerSlots<T> {
  item$?: QRL<(props: { item: T }) => JSXOutput>;
}

export default component$(
  <T,>({
    items,
    item$,
    class: className,
    style,
    ...attributes
  }: PickerProps<T> & PickerSlots<T> & { class?: ClassList; style?: CSSProperties }) => {
    return (
      <ul {...scopeAttributes(attributes)} class={className} style={style}>
        {items.map((item, index) => (
          <li key={index}>{item$?.({ item })}</li>
        ))}
      </ul>
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
