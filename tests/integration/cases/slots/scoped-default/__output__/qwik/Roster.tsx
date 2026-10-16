import Names from "./Names";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ names: string[] } & { class?: ClassList; style?: CSSProperties }>(
  ({ names, class: className, style }) => {
    return (
      <>
        <Names
          names={names}
          default$={({ item }) => <b>{item}!</b>}
          class={className}
          style={style}
        />
      </>
    );
  },
);
