import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

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
  }: TableProps<T> &
    Omit<PropsOf<"table">, "caption" | "rows" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }) => {
    return (
      <table class={className} style={style} {...attributes}>
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
