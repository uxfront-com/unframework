export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export default function AuthorByline(props: AuthorBylineProps) {
  return (
    <p class="byline">
      By {props.author}, {props.affiliation ?? "independent"}
      <br />
      <time datetime={props.published}>{props.published}</time> · {props.minutes} min read
    </p>
  );
}
