import { CardIcon } from "./CardIcon";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { title: string } & Omit<PropsOf<"div">, "title" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, class: className, style, ...attributes }) => {
  return (
    <div class={["card", className]} style={style} {...attributes}>
      <CardIcon symbol="+" />
      <h3>{title}</h3>
      <CardIcon symbol="-" />
    </div>
  );
});
