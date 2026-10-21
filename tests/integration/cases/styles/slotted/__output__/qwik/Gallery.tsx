import Frame from "./Frame";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <section class={className} style={style}>
        <Frame>
          <p class="caption" data-uf-9dc516fd-s="">
            A quiet harbour
          </p>
        </Frame>
        <p class="caption">Outside the frame</p>
      </section>
    );
  },
);
