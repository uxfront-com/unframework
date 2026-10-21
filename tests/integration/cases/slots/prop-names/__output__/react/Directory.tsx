import Table from "./Table";
import type { CSSProperties } from "react";

export interface Person {
  id: string;
  name: string;
}

export interface DirectoryAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
      renderRow={({ name, "data-id": id, index }) => (
        <span>
          {index + 1}: {name} ({id})
        </span>
      )}
    />
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
