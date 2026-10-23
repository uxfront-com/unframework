import type { JSX } from "solid-js";

export default function Note(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `note-box ${props.class}` : "note-box"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p class="note">{props.text}</p>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
