import { Transition } from "./_unframework/Transition";
import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";
import "./FadeFace.uf.tsx.css";

export interface FadeFaceSlots {
  children?: JSX.Element;
}

export default function FadeFace(
  props: { bold: boolean } & FadeFaceSlots &
    Omit<ComponentProps<"div">, "bold" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["bold", "children", "class"]);

  return (
    <div
      class={props.class ? `fade-face ${props.class}` : "fade-face"}
      data-uf-c9301a2a=""
      {...others}
    >
      <Transition name="face">
        <Show
          when={props.bold}
          fallback={
            <i class="face" data-uf-c9301a2a="">
              {props.children}
            </i>
          }
        >
          <b class="face" data-uf-c9301a2a="">
            {props.children}
          </b>
        </Show>
      </Transition>
    </div>
  );
}
