import { type ComponentProps, type JSX, onMount } from "solid-js";

export default function Chart(
  props: Omit<ComponentProps<"p">, "style"> & { style?: JSX.CSSProperties },
) {
  onMount(() => {
    throw new Error("The chart could not start");
  });

  return <p {...props}>Chart</p>;
}
