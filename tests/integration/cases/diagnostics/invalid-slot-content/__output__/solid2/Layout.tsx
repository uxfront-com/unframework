import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface LayoutSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export function Layout(
  props: LayoutSlots &
    Omit<ComponentProps<"main">, "title" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "children");

  return (
    <main {...others}>
      <h1>{props.title}</h1>
      {props.children}
    </main>
  );
}
