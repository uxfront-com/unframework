import { type CSSProperties, type ClassList, type PropsOf, Slot, component$ } from "@qwik.dev/core";

export default component$<
  { strong: boolean } & Omit<PropsOf<"p">, "strong" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ strong, class: className, style, ...attributes }) => {
  return (
    <p class={["emphasis", className]} style={style} {...attributes}>
      {strong ? (
        <b>
          <Slot />
        </b>
      ) : (
        <i>
          <Slot />
        </i>
      )}
    </p>
  );
});
