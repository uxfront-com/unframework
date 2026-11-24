import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Transition(
  props: { step: string } & Omit<ComponentProps<"p">, "step" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["step", "class"]);

  return (
    <p class={props.class ? `step ${props.class}` : "step"} {...others}>
      Step: {props.step}
    </p>
  );
}
