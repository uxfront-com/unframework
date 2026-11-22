import Table from "./Table";
import { type ComponentProps, splitProps } from "solid-js";

export interface Person {
  id: string;
  name: string;
}

export default function Directory(
  props: { people: Person[] } & Omit<ComponentProps<typeof Table>, "people" | "row">,
) {
  const [, others] = splitProps(props, ["people"]);

  return (
    <Table
      people={props.people}
      {...others}
      row={({ name, "data-id": id, index }) => (
        <span>
          {index + 1}: {name} ({id})
        </span>
      )}
    />
  );
}
