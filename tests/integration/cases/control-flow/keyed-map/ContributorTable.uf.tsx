export interface Contributor {
  login: string;
  name: string;
  commits: number;
}

export interface ContributorTableProps {
  caption: string;
  contributors: Contributor[];
}

export default function ContributorTable({ caption, contributors }: ContributorTableProps) {
  return (
    <table class="contributors">
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
}
