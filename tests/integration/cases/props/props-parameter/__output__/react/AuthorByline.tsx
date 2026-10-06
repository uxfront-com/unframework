export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export default function AuthorByline(props: AuthorBylineProps) {
  return (
    <p className="byline">
      By {props.author}, {props.affiliation ?? "independent"}
      <br />
      <time dateTime={props.published}>{props.published}</time> · {props.minutes} min read
    </p>
  );
}
