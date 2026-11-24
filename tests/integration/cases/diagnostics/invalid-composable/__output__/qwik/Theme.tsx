import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  createContextId,
} from "@qwik.dev/core";

export const ThemeKey = createContextId<string>("theme");

export default component$<
  Omit<PropsOf<"p">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <p class={className} style={style} {...attributes}>
      Theme
    </p>
  );
});
