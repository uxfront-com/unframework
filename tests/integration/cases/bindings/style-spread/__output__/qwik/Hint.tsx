import { styleObject } from "./_unframework/styleObject";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}

export default component$<
  HintProps &
    Omit<PropsOf<"small">, "text" | "attrs" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, attrs, class: className, style, ...attributes }) => {
  return (
    <small
      id={attrs.id}
      style={{ ...styleObject(attrs.style), ...style }}
      class={className}
      {...attributes}
    >
      {text}
    </small>
  );
});
