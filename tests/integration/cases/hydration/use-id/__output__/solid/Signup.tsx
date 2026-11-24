import Field from "./Field";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface SignupProps {
  name: string;
  email: string;
}

export default function Signup(
  props: SignupProps &
    Omit<ComponentProps<"form">, "name" | "email" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["name", "email", "class"]);

  return (
    <form class={props.class ? `signup ${props.class}` : "signup"} aria-label="Sign up" {...others}>
      <Field label={props.name} hint="As it appears on your card." />
      <Field label={props.email} hint="We send the receipt here." />
    </form>
  );
}
