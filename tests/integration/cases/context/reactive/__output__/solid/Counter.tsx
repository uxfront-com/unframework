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
      <section aria-label="Counter" class={props.class} style={props.style}>
        <Display />
        <button type="button" onClick={() => setCount(count() + 1)}>
          Add one
        </button>
      </section>
    </CountKey.Provider>
  );
}
