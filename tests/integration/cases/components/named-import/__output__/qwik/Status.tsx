import { Badge } from "./Badge";
import { Pill as Tag } from "./Pill";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ state: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ state, class: className, style }) => {
    return (
      <p class={["status", className]} style={style}>
        <Badge text="Build" />
        <Tag text={state} />
      </p>
    );
  },
);
