import type { CSSProperties, ReactNode } from "react";

export interface Person {
  id: string;
  name: string;
}

export interface TableSlots {
  renderRow?: (props: { name: string; "data-id": string; index: number }) => ReactNode;
}

export interface TableAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Table({
  people,
  renderRow,
  className,
  style,
  ...attributes
}: { people: Person[] } & TableSlots & TableAttributes) {
  return (
    <ol aria-label="People" className={className} style={style} {...scopeAttributes(attributes)}>
      {people.map((person, index) => (
        <li key={person.id}>{renderRow?.({ name: person.name, "data-id": person.id, index })}</li>
      ))}
    </ol>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
