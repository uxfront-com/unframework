import type { JSX } from "solid-js";

export default function Tag(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <span
      class={props.class ? `tag ${props.class}` : "tag"}
      style={{ ...{ padding: "2px 6px", color: "rgb(30, 30, 30)" }, ...props.style }}
      {...scopeAttributes(props)}
    >
      {props.label}
    </span>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
