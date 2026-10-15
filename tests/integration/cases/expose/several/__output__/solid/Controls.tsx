import Counter from "./Counter";
import { type JSX, onCleanup } from "solid-js";

export default function Controls(props: { class?: string; style?: JSX.CSSProperties }) {
  let counter: { increment(): void; reset(): void } | null = null;

  return (
    <div class={props.class ? `controls ${props.class}` : "controls"} style={props.style}>
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
