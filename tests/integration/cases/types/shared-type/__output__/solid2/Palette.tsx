import Swatch from "./Swatch";
import type { Tone } from "./types";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export type { Tone } from "./types";

export default function Palette(
  props: { tone: Tone } & Omit<ComponentProps<"div">, "tone" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "tone", "class");

  return (
    <div class={props.class ? `palette ${props.class}` : "palette"} {...others}>
      <Swatch tone={props.tone} />
    </div>
  );
}
