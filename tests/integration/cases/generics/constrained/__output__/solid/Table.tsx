import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}

export default function Table<T extends { id: string; label: string }>(
  props: TableProps<T> &
    Omit<ComponentProps<"table">, "caption" | "rows" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["caption", "rows"]);

  return (
    <table {...others}>
      <caption>{props.caption}</caption>
      <tbody>
        <KeyedFor each={props.rows} by={(row) => row.id}>
          {(row) => (
            <tr>
              <th scope="row">{row.value.id}</th>
              <td>{row.value.label}</td>
            </tr>
          )}
        </KeyedFor>
      </tbody>
    </table>
  );
}
