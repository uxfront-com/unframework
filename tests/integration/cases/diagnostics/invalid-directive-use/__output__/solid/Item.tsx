import type { ComponentProps, JSX } from "solid-js";

export function Item(props: Omit<ComponentProps<"span">, "style"> & { style?: JSX.CSSProperties }) {
  return <span {...props}>Item</span>;
}
