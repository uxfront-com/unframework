import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";
import { badge } from "virtual:styleframe";
import "virtual:styleframe.css";

export default component$<
  { label: string } & Omit<PropsOf<"span">, "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, class: className, style, ...attributes }) => {
  return (
    <span class={[badge(), className]} style={style} {...attributes}>
      {label}
    </span>
  );
});
