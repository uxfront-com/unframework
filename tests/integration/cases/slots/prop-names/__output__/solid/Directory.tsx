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
    />
  );
}
