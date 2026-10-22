import type { JSX } from "solid-js";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";
import "./Card.uf.tsx.css";

export default function Card(
  props: { title: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article
      class={cx("card", button({ size: "lg", tone: "primary" }), props.class)}
      data-uf-9cfb6163=""
      style={props.style}
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
