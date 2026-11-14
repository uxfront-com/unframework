import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface Contributor {
  login: string;
  name: string;
  commits: number;
}

export interface ContributorTableProps {
  caption: string;
  contributors: Contributor[];
}

export default component$<ContributorTableProps & { class?: ClassList; style?: CSSProperties }>(
  ({ caption, contributors, class: className, style, ...attributes }) => {
    return (
      <table class={["contributors", className]} {...scopeAttributes(attributes)} style={style}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Commits</th>
          </tr>
        </thead>
        <tbody>
          {contributors.map((contributor) => (
            <tr key={contributor.login}>
              <td>
                <a href={`https://example.com/people/${contributor.login}`}>{contributor.name}</a>
              </td>
              <td>{contributor.commits}</td>
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
