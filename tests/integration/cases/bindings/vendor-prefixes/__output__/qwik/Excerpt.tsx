import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface ExcerptProps {
  title: string;
  text: string;
  fill: string;
  stroke: string;
}

export default component$<ExcerptProps & { class?: ClassList; style?: CSSProperties }>(
  ({ title, text, fill, stroke, class: className, style, ...attributes }) => {
    return (
      <article class={["excerpt", className]} {...scopeAttributes(attributes)} style={style}>
        <h2
          style={{
            WebkitTextFillColor: fill,
            WebkitTextStrokeColor: stroke,
            WebkitTextStrokeWidth: "1px",
            color: "rgb(0, 0, 0)",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: "2",
            overflow: "hidden",
            width: "240px",
          }}
        >
          {text}
        </p>
      </article>
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
