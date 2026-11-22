import type { ButtonProps } from "./types";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  ButtonProps &
    Omit<PropsOf<"button">, "disabled" | "label" | "id" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ id, label, disabled = false, class: className, style, ...attributes }) => {
  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      class={className}
      style={style}
      {...attributes}
    >
      {label}
    </button>
  );
});
