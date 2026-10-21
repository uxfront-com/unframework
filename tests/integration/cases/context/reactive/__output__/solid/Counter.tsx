import Display from "./Display";
import { type JSX, createContext, createSignal } from "solid-js";

export const CountKey = createContext<{ readonly value: number }>();

export default function Counter(props: { class?: string; style?: JSX.CSSProperties }) {
  const [count, setCount] = createSignal(1);

  return (
    <CountKey.Provider
      value={{
        get value() {
          return count();
        },
      }}
    >
      <section
        aria-label="Counter"
        class={props.class}
        style={props.style}
        {...scopeAttributes(props)}
      >
        <Display />
        <button type="button" onClick={() => setCount(count() + 1)}>
          Add one
        </button>
      </section>
    </CountKey.Provider>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
