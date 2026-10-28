import { For, type JSX } from "solid-js";

export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}

export default function Table(
  props: TableProps<T> & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <table class={props.class} style={props.style} {...scopeAttributes(props)}>
      <caption>{props.caption}</caption>
      <tbody>
        <For each={props.rows}>
          {(row) => (
            <tr>
              <th scope="row">{row.id}</th>
              <td>{row.label}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
