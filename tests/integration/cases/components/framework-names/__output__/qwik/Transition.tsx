import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ step: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ step, class: className, style }) => {
    return (
      <p class={["step", className]} style={style}>
        Step: {step}
      </p>
    );
  },
);
