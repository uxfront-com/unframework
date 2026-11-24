import type { ComponentProps, JSX } from "solid-js";

export function Hint(props: Omit<ComponentProps<"p">, "style"> & { style?: JSX.CSSProperties }) {
  return <p {...props}>Hint</p>;
}
