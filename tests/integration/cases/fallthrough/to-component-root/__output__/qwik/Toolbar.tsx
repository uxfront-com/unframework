import Primary from "./Primary";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"div">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  return (
    <div role="toolbar" aria-label="Actions" class={className} style={style} {...attributes}>
      <Primary text="Save" class={["wide"]} />
    </div>
  );
});
