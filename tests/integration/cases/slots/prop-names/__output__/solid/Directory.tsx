import Table from "./Table";
import type { JSX } from "solid-js";

export interface Person {
  id: string;
  name: string;
}

export default function Directory(
  props: { people: Person[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Table
      people={props.people}
      row={({ name, "data-id": id, index }) => (
        <span>
          {index + 1}: {name} ({id})
        </span>
      )}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    />
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
