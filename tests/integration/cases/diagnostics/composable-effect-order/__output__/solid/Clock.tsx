import { useClock } from "./useClock";
import { type ComponentProps, type JSX, createSignal, onMount, splitProps } from "solid-js";

export default function Clock(
  props: Omit<ComponentProps<"p">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [ready, setReady] = createSignal(false);

  onMount(() => {
    setReady(true);
  });

  const { started } = useClock();

  return (
    <p class={props.class ? `clock ${props.class}` : "clock"} {...others}>
      {ready() ? "Ready" : "Waiting"}, {started() ? "started" : "stopped"}
    </p>
  );
}
