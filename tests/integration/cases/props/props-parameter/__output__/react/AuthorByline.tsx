import type { ComponentPropsWithRef } from "react";

export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export type AuthorBylineAttributes = Omit<
  ComponentPropsWithRef<"p">,
  "author" | "published" | "minutes" | "affiliation" | "children"
>;

export default function AuthorByline(props: AuthorBylineProps & AuthorBylineAttributes) {
  const {
    className,
    style,
    author: _author,
    published: _published,
    minutes: _minutes,
    affiliation: _affiliation,
    ...attributes
  } = props;

  return (
    <p className={cx("byline", className)} style={style} {...attributes}>
      By {props.author}, {props.affiliation ?? "independent"}
      <br />
      <time dateTime={props.published}>{props.published}</time> · {props.minutes} min read
    </p>
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
