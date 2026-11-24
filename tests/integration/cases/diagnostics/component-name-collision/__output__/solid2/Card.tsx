import type { ComponentProps, JSX } from "@solidjs/web";

export function Card(
  props: Omit<ComponentProps<"p">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return <p {...props}>Card</p>;
}
