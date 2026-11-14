import Field from "./Field";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface SignupProps {
  name: string;
  email: string;
}

export default component$<SignupProps & { class?: ClassList; style?: CSSProperties }>(
  ({ name, email, class: className, style, ...attributes }) => {
    return (
      <form
        class={["signup", className]}
        aria-label="Sign up"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <Field label={name} hint="As it appears on your card." />
        <Field label={email} hint="We send the receipt here." />
      </form>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
