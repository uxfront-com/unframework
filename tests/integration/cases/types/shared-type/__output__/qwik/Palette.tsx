import Swatch from "./Swatch";
import type { Tone } from "./types";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export type { Tone } from "./types";

export default component$<
  { tone: Tone } & Omit<PropsOf<"div">, "tone" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ tone, class: className, style, ...attributes }) => {
  return (
    <div class={["palette", className]} style={style} {...attributes}>
      <Swatch tone={tone} />
    </div>
  );
});
