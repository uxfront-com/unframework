import type { JSX } from "solid-js";

export interface ExcerptProps {
  title: string;
  text: string;
  fill: string;
  stroke: string;
}

export default function Excerpt(
  props: ExcerptProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article
      class={props.class ? `excerpt ${props.class}` : "excerpt"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2
        style={{
          "-webkit-text-fill-color": props.fill,
          "-webkit-text-stroke-color": props.stroke,
          "-webkit-text-stroke-width": "1px",
          color: "rgb(0, 0, 0)",
        }}
      >
        {props.title}
      </h2>
      <p
        style={{
          display: "-webkit-box",
          "-webkit-box-orient": "vertical",
          "-webkit-line-clamp": "2",
          overflow: "hidden",
          width: "240px",
        }}
      >
        {props.text}
      </p>
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
