import Table from "./Table";
import type { ComponentPropsWithRef } from "react";

export interface Person {
  id: string;
  name: string;
}

export type DirectoryAttributes = Omit<
  ComponentPropsWithRef<typeof Table>,
  "people" | "children" | "renderRow"
>;

export default function Directory({
  people,
  className,
  style,
  ...attributes
}: { people: Person[] } & DirectoryAttributes) {
  return (
    <Table
      people={people}
      className={className}
      style={style}
      {...attributes}
      renderRow={({ name, "data-id": id, index }) => (
        <span>
          {index + 1}: {name} ({id})
        </span>
      )}
    />
  );
}
