import { For, type JSX } from "solid-js";

export interface Person {
  id: string;
  name: string;
}

export interface TableSlots {
  row?: (props: { name: string; "data-id": string; index: number }) => JSX.Element;
}

export default function Table(
  props: { people: Person[] } & TableSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ol aria-label="People" class={props.class} style={props.style}>
      <For each={props.people}>
        {(person, index) => (
          <li>{props.row?.({ name: person.name, "data-id": person.id, index: index() })}</li>
        )}
      </For>
    </ol>
  );
}
