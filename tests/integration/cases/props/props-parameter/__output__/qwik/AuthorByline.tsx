import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export default component$<
  AuthorBylineProps &
    Omit<PropsOf<"p">, "author" | "published" | "minutes" | "affiliation" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>((props) => {
  const {
    author: _author,
    published: _published,
    minutes: _minutes,
    affiliation: _affiliation,
    class: _class,
    style: _style,
    ...attributes
  } = props;

  return (
    <p class={["byline", props.class]} style={props.style} {...attributes}>
      By {props.author}, {props.affiliation ?? "independent"}
      <br />
      <time dateTime={props.published}>{props.published}</time> · {props.minutes} min read
    </p>
  );
});
