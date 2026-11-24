import type { Sized, Toned } from "./types";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

type ChipProps = Sized & Toned & { label: string };

export default component$<
  ChipProps &
    Omit<PropsOf<"span">, "size" | "tone" | "label" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ size, tone = "neutral", label, class: className, style, ...attributes }) => {
  return (
    <span class={[`chip chip-${size} chip-${tone}`, className]} style={style} {...attributes}>
      {label}
    </span>
  );
});
