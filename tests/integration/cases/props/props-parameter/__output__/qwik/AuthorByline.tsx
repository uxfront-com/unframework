import { component$ } from "@qwik.dev/core";

export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export default component$<AuthorBylineProps>((props) => {
  return (
    <p class="byline">
      By {props.author}, {props.affiliation ?? "independent"}
      <br />
      <time dateTime={props.published}>{props.published}</time> · {props.minutes} min read
    </p>
  );
});
