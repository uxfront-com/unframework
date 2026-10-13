import Field from "./Field";
import type { JSX } from "solid-js";

export default function Form(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <form aria-label="Sign up" class={props.class} style={props.style}>
      <Field label="Email" />
      <Field label="Name" />
    </form>
  );
}
