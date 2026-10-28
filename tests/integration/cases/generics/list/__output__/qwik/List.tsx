import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

export default component$<ListProps<T> & { class?: ClassList; style?: CSSProperties }>(
  ({ label, items, selected, class: className, style, ...attributes }) => {
    return (
      <ul aria-label={label} {...scopeAttributes(attributes)} class={className} style={style}>
        {items.map((item, index) => (
          <li key={index} aria-current={item === selected ? "true" : undefined}>
            {String(item)}
          </li>
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
