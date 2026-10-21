import { For, type JSX } from "solid-js";

export interface Contributor {
  login: string;
  name: string;
  commits: number;
}

export interface ContributorTableProps {
  caption: string;
  contributors: Contributor[];
}

export default function ContributorTable(
  props: ContributorTableProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <table
      class={props.class ? `contributors ${props.class}` : "contributors"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <caption>{props.caption}</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Commits</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.contributors}>
          {(contributor) => (
            <tr>
              <td>
                <a href={`https://example.com/people/${contributor.login}`}>{contributor.name}</a>
              </td>
              <td>{contributor.commits}</td>
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
