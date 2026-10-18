import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style }) => {
    return (
      <span class={["chip", className]} style={style}>
        {label}
      </span>
    );
  },
);
