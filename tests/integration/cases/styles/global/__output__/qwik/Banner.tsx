import Hint from "./Hint";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ tip: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ tip, class: className, style }) => {
    return (
      <div class={["banner", className]} data-uf-e25060c2="" style={style}>
        <Hint text={tip} data-uf-e25060c2="" />
      </div>
    );
  },
);
