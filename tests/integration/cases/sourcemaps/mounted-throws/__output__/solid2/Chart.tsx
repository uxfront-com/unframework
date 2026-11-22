import type { ComponentProps, JSX } from "@solidjs/web";
import { onSettled } from "solid-js";

export default function Chart(
  props: Omit<ComponentProps<"p">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  onSettled(() => {
    throw new Error("The chart could not start");
  });

  return <p {...props}>Chart</p>;
}
