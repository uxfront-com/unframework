import Button from "./Button";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <div
        role="toolbar"
        aria-label="Actions"
        class={["toolbar", className]}
        data-uf-a33d603f=""
        style={style}
      >
        <Button text="Save" data-uf-a33d603f="" />
        <Button text="Cancel" data-uf-a33d603f="" />
      </div>
    );
  },
);
