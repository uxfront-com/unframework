import type { ComponentProps, JSX } from "@solidjs/web";

export function Hint(
  props: Omit<ComponentProps<"p">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return <p {...props}>Hint</p>;
}
