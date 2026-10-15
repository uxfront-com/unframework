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
    <pre class={props.class} style={props.style}>
      {props.name}
      {["\n"]}
      {props.street}
      {["\n"]}
      {props.city ?? "-"}
    </pre>
  );
}
