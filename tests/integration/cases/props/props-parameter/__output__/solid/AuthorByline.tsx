import type { JSX } from "solid-js";

export interface AuthorBylineProps {
  author: string;
  published: string;
  minutes: number;
  affiliation?: string;
}

export default function AuthorByline(
  props: AuthorBylineProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p
      class={props.class ? `byline ${props.class}` : "byline"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      By {props.author}, {props.affiliation ?? "independent"}
      <br />
      <time datetime={props.published}>{props.published}</time> · {props.minutes} min read
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
