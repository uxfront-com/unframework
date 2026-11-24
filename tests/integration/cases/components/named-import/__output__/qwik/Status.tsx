import { Badge } from "./Badge";
import { Pill as Tag } from "./Pill";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { state: string } & Omit<PropsOf<"p">, "state" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ state, class: className, style, ...attributes }) => {
  return (
    <p class={["status", className]} style={style} {...attributes}>
      <Badge text="Build" />
      <Tag text={state} />
    </p>
  );
});
