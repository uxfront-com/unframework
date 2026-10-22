import { type JSX, createSignal, untrack } from "solid-js";

export default function Counter(
  props: { start: number } & {
    class?: string;
    style?: JSX.CSSProperties;
    ref?: (api: { increment: () => void; reset: () => void }) => void;
  },
) {
  const [count, setCount] = createSignal(untrack(() => props.start));

  function increment() {
    setCount(count() + 1);
  }

  const reset = () => {
    setCount(props.start);
  };

  untrack(() => props.ref?.({ increment, reset }));

  return (
    <output
      class={props.class ? `count ${props.class}` : "count"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      {count()}
    </output>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
