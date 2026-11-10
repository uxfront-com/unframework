import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

interface Fruit {
  id: string;
  name: string;
  children: Fruit[];
}

export const Count = component$<{ items: Fruit[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ items, class: className, style, ...attributes }) => {
    return (
      <p {...scopeAttributes(attributes)} class={className} style={style}>
        {items.length} fruits
      </p>
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
