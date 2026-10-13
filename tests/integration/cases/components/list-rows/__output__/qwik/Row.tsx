import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { name: string; done: boolean } & { class?: ClassList; style?: CSSProperties }
>(({ name, done, class: className, style }) => {
  return (
    <div role="listitem" class={["row", { done }, className]} style={style}>
      {name}
      {done ? " (done)" : ""}
    </div>
  );
});
