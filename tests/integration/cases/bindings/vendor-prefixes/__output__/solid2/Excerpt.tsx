import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface ExcerptProps {
  title: string;
  text: string;
  fill: string;
  stroke: string;
}

export default function Excerpt(
  props: ExcerptProps &
    Omit<ComponentProps<"article">, "title" | "text" | "fill" | "stroke" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "text", "fill", "stroke", "class");

  return (
    <article class={props.class ? `excerpt ${props.class}` : "excerpt"} {...others}>
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
