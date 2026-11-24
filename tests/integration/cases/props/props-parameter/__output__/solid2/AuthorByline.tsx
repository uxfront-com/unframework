import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export default function AuthorByline(
  props: AuthorBylineProps &
    Omit<
      ComponentProps<"p">,
      "author" | "published" | "minutes" | "affiliation" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "author", "published", "minutes", "affiliation", "class");

  return (
    <p class={props.class ? `byline ${props.class}` : "byline"} {...others}>
      By {props.author}, {props.affiliation ?? "independent"}
      <br />
      <time datetime={props.published}>{props.published}</time> · {props.minutes} min read
    </p>
  );
}
