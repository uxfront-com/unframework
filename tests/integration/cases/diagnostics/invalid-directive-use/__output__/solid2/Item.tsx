import type { ComponentProps, JSX } from "@solidjs/web";

export function Item(
  props: Omit<ComponentProps<"span">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  return <span {...props}>Item</span>;
}
