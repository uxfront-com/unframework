import { CountKey } from "./Counter";
import { type ComponentProps, type JSX, createSignal, useContext } from "solid-js";

export default function Display(
  props: Omit<ComponentProps<"output">, "style"> & { style?: JSX.CSSProperties },
) {
  const [none] = createSignal(0);
  const count = useContext(CountKey) ?? {
    get value() {
      return none();
    },
  };

  return <output {...props}>Count: {count.value}</output>;
}
