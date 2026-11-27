import { Transition } from "./_unframework/Transition";
import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";

export interface FadeFaceSlots {
  children?: JSX.Element;
}

export default function FadeFace(
  props: { bold: boolean } & FadeFaceSlots &
    Omit<ComponentProps<"div">, "bold" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["bold", "children", "class"]);

  return (
    <div class={props.class ? `fade-face ${props.class}` : "fade-face"} {...others}>
      <Transition name="face">
        <Show when={props.bold} fallback={<i class="face">{props.children}</i>}>
          <b class="face">{props.children}</b>
        </Show>
      </Transition>
    </div>
  );
}
