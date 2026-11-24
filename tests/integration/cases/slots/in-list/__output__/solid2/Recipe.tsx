import Steps from "./Steps";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Recipe(
  props: { steps: string[] } & Omit<ComponentProps<"div">, "steps" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "steps");

  return (
    <div {...others}>
      <Steps steps={props.steps} marker={<span aria-hidden="true">&gt; </span>} />
    </div>
  );
}
