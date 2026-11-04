import { useCounter } from "./useCounter";
import { type JSX, createSignal } from "solid-js";

export interface ClickerEvents {
  onLimit?: (count: number) => void;
}

export default function Clicker(
  props: ClickerEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [message, setMessage] = createSignal("Keep going");
  const { count, step, increment, reset } = useCounter(3, (reached) => {
    setMessage(`Reached ${reached}`);
    props.onLimit?.(reached);
  });

  return (
    <section
      class={props.class ? `clicker ${props.class}` : "clicker"}
      aria-label="Clicker"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">Count: {count()}</p>
      <p>{message()}</p>
      <button type="button" onClick={() => increment()}>
        Add {step}
      </button>
      <button type="button" onClick={() => reset()}>
        Reset
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
