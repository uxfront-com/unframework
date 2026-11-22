import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface LayoutSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export function Layout(
  props: LayoutSlots &
    Omit<ComponentProps<"main">, "title" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["title", "children"]);

  return (
    <main {...others}>
      <h1>{props.title}</h1>
      {props.children}
    </main>
  );
}
