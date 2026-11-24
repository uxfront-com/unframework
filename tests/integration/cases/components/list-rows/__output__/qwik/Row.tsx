import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { name: string; done: boolean } & Omit<PropsOf<"div">, "name" | "done" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, done, class: className, style, ...attributes }) => {
  return (
    <div role="listitem" class={["row", { done }, className]} style={style} {...attributes}>
      {name}
      {done ? " (done)" : ""}
    </div>
  );
});
