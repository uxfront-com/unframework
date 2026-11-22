import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Progress.uf.tsx.css";

export default function Progress(
  props: { label: string } & Omit<ComponentProps<"div">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "class");

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
