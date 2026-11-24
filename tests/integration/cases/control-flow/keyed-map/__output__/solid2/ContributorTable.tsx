import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

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
  props: ContributorTableProps &
    Omit<ComponentProps<"table">, "caption" | "contributors" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "caption", "contributors", "class");

  return (
    <table class={props.class ? `contributors ${props.class}` : "contributors"} {...others}>
      <caption>{props.caption}</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Commits</th>
        </tr>
      </thead>
      <tbody>
        <KeyedFor each={props.contributors} by={(contributor) => contributor.login}>
          {(contributor) => (
            <tr>
              <td>
                <a href={`https://example.com/people/${contributor.value.login}`}>
                  {contributor.value.name}
                </a>
              </td>
              <td>{contributor.value.commits}</td>
            </tr>
          )}
        </KeyedFor>
      </tbody>
    </table>
  );
}
