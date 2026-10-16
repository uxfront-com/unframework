import Avatar from "./Avatar";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const picked = useSignal("none");

    return (
      <div class={className} style={style}>
        <Avatar imageURL="/a.png" userID={7} onPickedURL$={(url) => (picked.value = url)} />
        <output>Picked: {picked.value}</output>
      </div>
    );
  },
);
