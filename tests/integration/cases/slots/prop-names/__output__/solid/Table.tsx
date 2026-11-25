import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface Person {
  id: string;
  name: string;
}

export interface TableSlots {
  row?: (props: { name: string; "data-id": string; index: number }) => JSX.Element;
}

export default function Table(
  props: { people: Person[] } & TableSlots &
    Omit<ComponentProps<"ol">, "people" | "row" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["people", "row"]);

  return (
    <ol aria-label="People" {...others}>
      <KeyedFor each={props.people} by={(person) => person.id}>
        {(person) => (
          <li>
            {props.row?.({
              name: person.value.name,
              "data-id": person.value.id,
              index: person.index,
            })}
          </li>
        )}
      </KeyedFor>
    </ol>
  );
}
