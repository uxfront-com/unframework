import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

interface Fruit {
  id: string;
  name: string;
  children: Fruit[];
}

export function Count(
  props: { items: Fruit[] } & Omit<ComponentProps<"p">, "items" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "items");

  return <p {...others}>{props.items.length} fruits</p>;
}
