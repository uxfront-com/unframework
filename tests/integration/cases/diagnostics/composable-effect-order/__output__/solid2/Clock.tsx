import { createState } from "./_unframework/createState";
import { useClock } from "./useClock";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, onSettled } from "solid-js";

export default function Clock(
  props: Omit<ComponentProps<"p">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [ready, setReady] = createState(false);

  onSettled(() => {
    setReady(true);
  });

  const { started } = useClock();

  return (
    <p class={props.class ? `clock ${props.class}` : "clock"} {...others}>
      {ready() ? "Ready" : "Waiting"}, {started() ? "started" : "stopped"}
    </p>
  );
}
