import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Progress.uf.tsx.css";

export default function Progress(
  props: { label: string } & Omit<ComponentProps<"div">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "class"]);

  return (
    <div
      class={props.class ? `progress ${props.class}` : "progress"}
      data-uf-0738d8af=""
      {...others}
    >
      <span class="dot" data-uf-0738d8af="" />
      <span data-uf-0738d8af="">{props.label}</span>
    </div>
  );
}
