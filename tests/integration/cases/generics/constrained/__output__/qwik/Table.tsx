import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}

export default component$(
  <T extends { id: string; label: string }>({
    caption,
    rows,
    class: className,
    style,
    ...attributes
  }: TableProps<T> & { class?: ClassList; style?: CSSProperties }) => {
    return (
      <table {...scopeAttributes(attributes)} class={className} style={style}>
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
