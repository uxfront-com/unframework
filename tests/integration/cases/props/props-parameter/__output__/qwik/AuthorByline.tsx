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
      <p class={["byline", props.class]} {...scopeAttributes(props)} style={props.style}>
        By {props.author}, {props.affiliation ?? "independent"}
        <br />
        <time dateTime={props.published}>{props.published}</time> · {props.minutes} min read
      </p>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
