import Level from "./Level";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <>
        <Level title="Book" class={className} style={style}>
          <Level title="Part">
            <Level title="Chapter" />
          </Level>
          <Level title="Appendix" />
        </Level>
      </>
    );
  },
);
