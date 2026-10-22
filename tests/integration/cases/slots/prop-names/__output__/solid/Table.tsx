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
    <ol aria-label="People" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <For each={props.people}>
        {(person, index) => (
          <li>{props.row?.({ name: person.name, "data-id": person.id, index: index() })}</li>
        )}
      </For>
    </ol>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
