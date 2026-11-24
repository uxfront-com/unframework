import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";
import "virtual:styleframe.css";

export default component$<
  { label: string } & Omit<PropsOf<"span">, "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, class: className, style, ...attributes }) => {
  return (
    <span
      class={[
        "_padding:lg _background-color:primary _color:on-primary _border-radius:[4px]",
        className,
      ]}
      style={style}
      {...attributes}
    >
      {label}
    </span>
  );
});
