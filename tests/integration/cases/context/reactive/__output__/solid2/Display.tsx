import { CountKey } from "./Counter";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { useContext } from "solid-js";

export default function Display(
  props: Omit<ComponentProps<"output">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [none] = createState(0);
  const count = useContext(CountKey) ?? {
    get value() {
      return none();
    },
  };

  return <output {...props}>Count: {count.value}</output>;
}
