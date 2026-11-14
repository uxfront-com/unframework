import Field from "./Field";
import type { JSX } from "solid-js";

export interface SignupProps {
  name: string;
  email: string;
}

export default function Signup(props: SignupProps & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <form
      class={props.class ? `signup ${props.class}` : "signup"}
      aria-label="Sign up"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Field label={props.name} hint="As it appears on your card." />
      <Field label={props.email} hint="We send the receipt here." />
    </form>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
