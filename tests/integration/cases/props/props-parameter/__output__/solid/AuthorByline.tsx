import type { JSX } from "solid-js";

export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export default function AuthorByline(
  props: AuthorBylineProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p class={props.class ? `byline ${props.class}` : "byline"} style={props.style}>
      By {props.author}, {props.affiliation ?? "independent"}
      <br />
      <time datetime={props.published}>{props.published}</time> · {props.minutes} min read
    </p>
  );
}
