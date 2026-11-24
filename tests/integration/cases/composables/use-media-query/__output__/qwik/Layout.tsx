import { useMediaQuery } from "./useMediaQuery";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const { matches: wide } = useMediaQuery("(min-width: 1px)");
  const { matches: tiny } = useMediaQuery("(max-width: 1px)");

  return (
    <section class={["layout", className]} aria-label="Layout" style={style} {...attributes}>
      <p role="status">{wide.value ? "Wide layout" : "Narrow layout"}</p>
      <p>{tiny.value ? "Tiny screen" : "Not a tiny screen"}</p>
    </section>
  );
});
