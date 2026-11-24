import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export interface AuthorBylineAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function AuthorByline(props: AuthorBylineProps & AuthorBylineAttributes) {
  return (
    <p className={cx("byline", props.className)} style={props.style} {...scopeAttributes(props)}>
      By {props.author}, {props.affiliation ?? "independent"}
      <br />
      <time dateTime={props.published}>{props.published}</time> · {props.minutes} min read
    </p>
  );
}
