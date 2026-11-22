import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export default function AuthorByline(
  props: AuthorBylineProps &
    Omit<ComponentProps<"p">, "author" | "published" | "minutes" | "affiliation" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["author", "published", "minutes", "affiliation", "class"]);

  return (
    <p class={props.class ? `byline ${props.class}` : "byline"} {...others}>
      By {props.author}, {props.affiliation ?? "independent"}
      <br />
      <time datetime={props.published}>{props.published}</time> · {props.minutes} min read
    </p>
  );
}
