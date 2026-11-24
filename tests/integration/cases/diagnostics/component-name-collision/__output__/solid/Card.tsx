import type { ComponentProps, JSX } from "solid-js";

export function Card(props: Omit<ComponentProps<"p">, "style"> & { style?: JSX.CSSProperties }) {
  return <p {...props}>Card</p>;
}
