import { CardIcon } from "./CardIcon";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ title: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ title, class: className, style }) => {
    return (
      <div class={["card", className]} style={style}>
        <CardIcon symbol="+" />
        <h3>{title}</h3>
        <CardIcon symbol="-" />
      </div>
    );
  },
);
