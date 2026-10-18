import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export default component$<AuthorBylineProps & { class?: ClassList; style?: CSSProperties }>(
  (props) => {
    return (
      <p class={["byline", props.class]} style={props.style}>
        By {props.author}, {props.affiliation ?? "independent"}
        <br />
        <time dateTime={props.published}>{props.published}</time> · {props.minutes} min read
      </p>
    );
  },
);
