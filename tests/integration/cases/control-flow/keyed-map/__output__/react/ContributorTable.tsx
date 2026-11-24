import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface Contributor {
  login: string;
  name: string;
  commits: number;
}

export interface ContributorTableProps {
  caption: string;
  contributors: Contributor[];
}

export type ContributorTableAttributes = Omit<
  ComponentPropsWithRef<"table">,
  "caption" | "contributors" | "children"
>;

export default function ContributorTable({
  caption,
  contributors,
  className,
  style,
  ...attributes
}: ContributorTableProps & ContributorTableAttributes) {
  return (
    <table className={cx("contributors", className)} style={style} {...attributes}>
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
