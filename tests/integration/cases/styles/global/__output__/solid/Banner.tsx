import Hint from "./Hint";
import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Banner.uf.tsx.css";

export default function Banner(
  props: { tip: string } & Omit<ComponentProps<"div">, "tip" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["tip", "class"]);

  return (
    <div class={props.class ? `banner ${props.class}` : "banner"} data-uf-e25060c2="" {...others}>
      <Hint text={props.tip} data-uf-e25060c2="" />
    </div>
  );
}
