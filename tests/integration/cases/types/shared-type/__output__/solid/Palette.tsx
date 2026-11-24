import Swatch from "./Swatch";
import type { Tone } from "./types";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export type { Tone } from "./types";

export default function Palette(
  props: { tone: Tone } & Omit<ComponentProps<"div">, "tone" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["tone", "class"]);

  return (
    <div class={props.class ? `palette ${props.class}` : "palette"} {...others}>
      <Swatch tone={props.tone} />
    </div>
  );
}
