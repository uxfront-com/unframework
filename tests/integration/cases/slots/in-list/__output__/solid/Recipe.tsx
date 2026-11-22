import Steps from "./Steps";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Recipe(
  props: { steps: string[] } & Omit<ComponentProps<"div">, "steps" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["steps"]);

  return (
    <div {...others}>
      <Steps steps={props.steps} marker={<span aria-hidden="true">&gt; </span>} />
    </div>
  );
}
