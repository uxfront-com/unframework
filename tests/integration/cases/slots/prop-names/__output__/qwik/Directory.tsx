import Table from "./Table";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface Person {
  id: string;
  name: string;
}

export default component$<{ people: Person[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ people, class: className, style, ...attributes }) => {
    return (
      <>
        <Table
          people={people}
          {...scopeAttributes(attributes)}
          row$={({ name, "data-id": id, index }) => (
            <span>
              {index + 1}: {name} ({id})
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
