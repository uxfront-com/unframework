import Table from "./Table";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
