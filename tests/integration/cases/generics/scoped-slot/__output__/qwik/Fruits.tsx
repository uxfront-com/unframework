import Picker from "./Picker";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

interface Fruit {
  name: string;
  count: number;
}

export default component$<{ fruits: Fruit[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ fruits, class: className, style, ...attributes }) => {
    return (
      <>
        <Picker
          items={fruits}
          {...scopeAttributes(attributes)}
          item$={({ item }) => (
            <span>
              {item.name} × {item.count}
            </span>
          )}
          class={className}
          style={style}
        />
      </>
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
