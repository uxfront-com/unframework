import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Transition(
  props: { step: string } & Omit<ComponentProps<"p">, "step" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "step", "class");

  return (
    <p class={props.class ? `step ${props.class}` : "step"} {...others}>
      Step: {props.step}
    </p>
  );
}
