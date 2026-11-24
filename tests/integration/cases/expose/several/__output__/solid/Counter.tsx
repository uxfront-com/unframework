import { type ComponentProps, type JSX, createSignal, splitProps, untrack } from "solid-js";

export default function Counter(
  props: { start: number } & Omit<ComponentProps<"output">, "start" | "ref" | "style"> & {
      style?: JSX.CSSProperties;
      ref?: (api: { increment: () => void; reset: () => void }) => void;
    },
) {
  const [, others] = splitProps(props, ["start", "ref", "class"]);

  const [count, setCount] = createSignal(untrack(() => props.start));

  function increment() {
    setCount(count() + 1);
  }

  const reset = () => {
    setCount(props.start);
  };

  untrack(() => props.ref?.({ increment, reset }));

  return (
    <output class={props.class ? `count ${props.class}` : "count"} {...others}>
      {count()}
    </output>
  );
}
