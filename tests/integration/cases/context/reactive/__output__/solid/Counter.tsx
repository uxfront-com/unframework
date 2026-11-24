import Display from "./Display";
import { type ComponentProps, type JSX, createContext, createSignal } from "solid-js";

export const CountKey = createContext<{ readonly value: number }>();

export default function Counter(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [count, setCount] = createSignal(1);

  return (
    <CountKey.Provider
      value={{
        get value() {
          return count();
        },
      }}
    >
      <section aria-label="Counter" {...props}>
        <Display />
        <button type="button" onClick={() => setCount(count() + 1)}>
          Add one
        </button>
      </section>
    </CountKey.Provider>
  );
}
