import type { JSX } from "solid-js";

export function SelectRow(
  props: { value: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <option value={props.value} class={props.class} style={props.style} {...scopeAttributes(props)}>
      {props.value}
    </option>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
