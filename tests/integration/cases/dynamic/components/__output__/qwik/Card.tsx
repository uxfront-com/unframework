import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style }) => {
    return (
      <div class={["card", className]} style={style}>
        <strong>{label}</strong>
      </div>
    );
  },
);
