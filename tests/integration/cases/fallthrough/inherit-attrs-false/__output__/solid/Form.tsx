import Field from "./Field";
import type { JSX } from "solid-js";

export default function Form(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <form aria-label="Sign up" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Field label="Email" />
      <Field label="Name" />
    </form>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
