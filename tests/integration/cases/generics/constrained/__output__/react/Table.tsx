import type { ComponentPropsWithRef } from "react";

export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}

export type TableAttributes = Omit<ComponentPropsWithRef<"table">, "caption" | "rows" | "children">;

export default function Table<T extends { id: string; label: string }>({
  caption,
  rows,
  className,
  style,
  ...attributes
}: TableProps<T> & TableAttributes) {
  return (
    <table className={className} style={style} {...attributes}>
      <caption>{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th scope="row">{row.id}</th>
            <td>{row.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
