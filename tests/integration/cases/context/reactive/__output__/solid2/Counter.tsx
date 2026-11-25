import Display from "./Display";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext } from "solid-js";

export const CountKey = createContext<{ readonly value: number } | null>(null);

export default function Counter(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [count, setCount] = createState(1);

  return (
    <CountKey
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
    </CountKey>
  );
}
