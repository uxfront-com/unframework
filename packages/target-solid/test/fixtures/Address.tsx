import type { JSX } from "solid-js";

export interface AddressProps {
  name: string;
  street: string;
  city?: string;
}

export default function Address(
  props: AddressProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <pre class={props.class} style={props.style} {...scopeAttributes(props)}>
      {props.name}
      {["\n"]}
      {props.street}
      {["\n"]}
      {props.city ?? "-"}
    </pre>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
