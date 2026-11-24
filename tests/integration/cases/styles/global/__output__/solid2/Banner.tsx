import Hint from "./Hint";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Banner.uf.tsx.css";

export default function Banner(
  props: { tip: string } & Omit<ComponentProps<"div">, "tip" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "tip", "class");

  return (
    <div class={props.class ? `banner ${props.class}` : "banner"} data-uf-e25060c2="" {...others}>
      <Hint text={props.tip} data-uf-e25060c2="" />
    </div>
  );
}
