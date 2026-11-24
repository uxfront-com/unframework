import { type ComponentProps, type JSX, splitProps } from "solid-js";

interface Fruit {
  id: string;
  name: string;
  children: Fruit[];
}

export function Count(
  props: { items: Fruit[] } & Omit<ComponentProps<"p">, "items" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["items"]);

  return <p {...others}>{props.items.length} fruits</p>;
}
