import type { ComponentPropsWithRef, ReactNode } from "react";

export interface Person {
  id: string;
  name: string;
}

export interface TableSlots {
  renderRow?: (props: { name: string; "data-id": string; index: number }) => ReactNode;
}

export type TableAttributes = Omit<
  ComponentPropsWithRef<"ol">,
  "people" | "renderRow" | "children"
>;

export default function Table({
  people,
  renderRow,
  className,
  style,
  ...attributes
}: { people: Person[] } & TableSlots & TableAttributes) {
  return (
    <ol aria-label="People" className={className} style={style} {...attributes}>
      {people.map((person, index) => (
        <li key={person.id}>{renderRow?.({ name: person.name, "data-id": person.id, index })}</li>
      ))}
    </ol>
  );
}
