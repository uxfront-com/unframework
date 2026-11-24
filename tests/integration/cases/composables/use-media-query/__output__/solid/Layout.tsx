import { useMediaQuery } from "./useMediaQuery";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Layout(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const { matches: wide } = useMediaQuery("(min-width: 1px)");
  const { matches: tiny } = useMediaQuery("(max-width: 1px)");

  return (
    <section
      class={props.class ? `layout ${props.class}` : "layout"}
      aria-label="Layout"
      {...others}
    >
      <p role="status">{wide() ? "Wide layout" : "Narrow layout"}</p>
      <p>{tiny() ? "Tiny screen" : "Not a tiny screen"}</p>
    </section>
  );
}
