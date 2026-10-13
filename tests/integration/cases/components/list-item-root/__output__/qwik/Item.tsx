import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style }) => {
    return (
      <li class={["item", className]} style={style}>
        {label}
      </li>
    );
  },
);
