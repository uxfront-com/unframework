import Frame from "./Frame";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <div class={className} style={style}>
        <Frame label="Filled" title$={() => "Sunset"}>
          <p>Taken at dusk.</p>
        </Frame>
        <Frame label="Empty" />
      </div>
    );
  },
);
