import Frame from "./Frame";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <div class={className} style={style}>
        <Frame label="Card" wide={false} title$={() => "Sunset"} />
        <Frame label="Panel" wide={true} title$={() => "Dawn"} />
        <Frame label="Empty" wide={true} />
      </div>
    );
  },
);
