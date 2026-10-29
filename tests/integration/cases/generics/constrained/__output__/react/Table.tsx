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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
