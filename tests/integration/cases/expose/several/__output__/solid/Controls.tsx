import Counter from "./Counter";
import { type ComponentProps, type JSX, onCleanup, splitProps } from "solid-js";

export default function Controls(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  let counter: { increment(): void; reset(): void } | null = null;

  return (
    <div class={props.class ? `controls ${props.class}` : "controls"} {...others}>
      <Counter
        ref={(api) => {
          counter = api;
          onCleanup(() => {
            counter = null;
          });
        }}
        start={10}
      />
      <button type="button" onClick={() => counter?.increment()}>
        More
      </button>
      <button type="button" onClick={() => counter?.reset()}>
        Reset
      </button>
    </div>
  );
}
