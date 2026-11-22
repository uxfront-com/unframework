import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}

export interface TableAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Table<T extends { id: string; label: string }>({
  caption,
  rows,
  className,
  style,
  ...attributes
}: TableProps<T> & TableAttributes) {
  return (
    <table className={className} style={style} {...scopeAttributes(attributes)}>
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
