import { type JSX, Show, createMemo, createSignal, mergeProps, untrack } from "solid-js";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export interface CounterEvents {
  onChange?: (value: number) => void;
}

export default function Counter(
  rawProps: CounterProps & CounterEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const props = mergeProps({ initial: 0, step: 1 } satisfies Partial<CounterProps>, rawProps);
  const [count, setCount] = createSignal(untrack(() => props.initial));
  const doubled = createMemo(() => count() * 2);

  function increment() {
    setCount(count() + props.step);
    props.onChange?.(count());
  }

  return (
    <div class={props.class ? `counter ${props.class}` : "counter"} style={props.style}>
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
