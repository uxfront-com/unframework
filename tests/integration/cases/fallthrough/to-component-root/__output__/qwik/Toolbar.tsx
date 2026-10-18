import Primary from "./Primary";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <div role="toolbar" aria-label="Actions" class={className} style={style}>
        <Primary text="Save" class={["wide"]} />
      </div>
    );
  },
);
