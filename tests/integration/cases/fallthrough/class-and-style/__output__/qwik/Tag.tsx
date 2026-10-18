import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style }) => {
    return (
      <span
        class={["tag", className]}
        style={{ padding: "2px 6px", color: "rgb(30, 30, 30)", ...style }}
      >
        {label}
      </span>
    );
  },
);
