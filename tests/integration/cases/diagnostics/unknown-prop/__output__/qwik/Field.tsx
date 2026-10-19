import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const Field = component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style }) => {
    return (
      <label class={className} style={style}>
        {label} <input type="text" />
      </label>
    );
  },
);
