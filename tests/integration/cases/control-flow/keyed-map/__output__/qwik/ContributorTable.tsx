import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface Contributor {
  login: string;
  name: string;
  commits: number;
}

export interface ContributorTableProps {
  caption: string;
  contributors: Contributor[];
}

export default component$<
  ContributorTableProps &
    Omit<PropsOf<"table">, "caption" | "contributors" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ caption, contributors, class: className, style, ...attributes }) => {
  return (
    <table class={["contributors", className]} style={style} {...attributes}>
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
});
