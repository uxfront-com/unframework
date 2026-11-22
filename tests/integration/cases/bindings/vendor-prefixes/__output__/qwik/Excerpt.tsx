import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface ExcerptProps {
  title: string;
  text: string;
  fill: string;
  stroke: string;
}

export default component$<
  ExcerptProps &
    Omit<PropsOf<"article">, "title" | "text" | "fill" | "stroke" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, text, fill, stroke, class: className, style, ...attributes }) => {
  return (
    <article class={["excerpt", className]} style={style} {...attributes}>
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
});
