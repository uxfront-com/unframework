import Counter from "./Counter";
import { type JSX, onCleanup } from "solid-js";

export default function Controls(props: { class?: string; style?: JSX.CSSProperties }) {
  let counter: { increment(): void; reset(): void } | null = null;

  return (
    <div
      class={props.class ? `controls ${props.class}` : "controls"}
      style={props.style}
      {...scopeAttributes(props)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
