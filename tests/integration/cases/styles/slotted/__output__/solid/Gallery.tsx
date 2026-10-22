import Frame from "./Frame";
import type { JSX } from "solid-js";

export default function Gallery(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <section class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Frame>
        <p class="caption" data-uf-9dc516fd-s="">
          A quiet harbour
        </p>
      </Frame>
      <p class="caption">Outside the frame</p>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
