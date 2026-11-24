import Field from "./Field";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface SignupProps {
  name: string;
  email: string;
}

export default component$<
  SignupProps &
    Omit<PropsOf<"form">, "name" | "email" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, email, class: className, style, ...attributes }) => {
  return (
    <form class={["signup", className]} aria-label="Sign up" style={style} {...attributes}>
      <Field label={name} hint="As it appears on your card." />
      <Field label={email} hint="We send the receipt here." />
    </form>
  );
});
