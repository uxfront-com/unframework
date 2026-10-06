import { For } from "solid-js";

export interface Contributor {
  login: string;
  name: string;
  commits: number;
}

export interface ContributorTableProps {
  caption: string;
  contributors: Contributor[];
}

export default function ContributorTable(props: ContributorTableProps) {
  return (
    <table class="contributors">
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
