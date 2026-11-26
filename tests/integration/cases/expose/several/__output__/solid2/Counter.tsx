import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, untrack } from "solid-js";

export default function Counter(
  props: { start: number } & Omit<ComponentProps<"output">, "start" | "ref" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
      ref?: (api: { increment: () => void; reset: () => void }) => void;
    },
) {
  const others = omit(props, "start", "ref", "class");

  const [count, setCount] = createState(untrack(() => props.start));

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
