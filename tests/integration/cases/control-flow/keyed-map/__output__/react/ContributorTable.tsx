import type { CSSProperties } from "react";

export interface Contributor {
  login: string;
  name: string;
  commits: number;
}

export interface ContributorTableProps {
  caption: string;
  contributors: Contributor[];
}

export interface ContributorTableAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ContributorTable({
  caption,
  contributors,
  className,
  style,
  ...attributes
}: ContributorTableProps & ContributorTableAttributes) {
  return (
    <table className={cx("contributors", className)} style={style} {...scopeAttributes(attributes)}>
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
