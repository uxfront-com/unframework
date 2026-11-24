import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, merge, omit, untrack } from "solid-js";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export interface CounterEvents {
  onChange?: (value: number) => void;
}

export default function Counter(
  rawProps: CounterProps &
    CounterEvents &
    Omit<ComponentProps<"div">, "initial" | "step" | "onChange" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get initial() {
      return rawProps.initial === undefined ? 0 : rawProps.initial;
    },
    get step() {
      return rawProps.step === undefined ? 1 : rawProps.step;
    },
  });
  const others = omit(props, "initial", "step", "onChange", "class");

  const [count, setCount] = createState(untrack(() => props.initial));
  const doubled = () => count() * 2;

  function increment() {
    setCount(count() + props.step);
    props.onChange?.(count());
  }

  return (
    <div class={props.class ? `counter ${props.class}` : "counter"} {...others}>
      <output>{count()}</output>
      <Show when={doubled() > 10}>
        <span>Big</span>
      </Show>
      <button type="button" onClick={increment}>
        +{props.step}
      </button>
    </div>
  );
}
