import Field from "./Field";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <form aria-label="Sign up" class={className} style={style}>
        <Field label="Email" />
        <Field label="Name" />
      </form>
    );
  },
);
