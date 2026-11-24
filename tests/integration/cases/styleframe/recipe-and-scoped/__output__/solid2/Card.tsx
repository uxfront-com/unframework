import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";
import "./Card.uf.tsx.css";

export default function Card(
  props: { title: string } & Omit<ComponentProps<"article">, "title" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "class");

  return (
    <article
      class={cx("card", button({ size: "lg", tone: "primary" }), props.class)}
      data-uf-9cfb6163=""
      {...others}
    >
      <h2 class="title" data-uf-9cfb6163="">
        {props.title}
      </h2>
    </article>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}
