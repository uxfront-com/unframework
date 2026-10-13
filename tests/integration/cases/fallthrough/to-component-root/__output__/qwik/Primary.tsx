import Base from "./Base";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    return (
      <>
        <Base text={text} class={["primary", className]} style={style} />
      </>
    );
  },
);
