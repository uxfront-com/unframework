import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export interface CardSlots {
  children?: JSX.Element;
}

export default function Card(
  props: CardSlots &
    Omit<ComponentProps<"div">, "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "children", "class");

  const [open, setOpen] = createState(false);

  return (
    <div class={props.class ? `card ${props.class}` : "card"} {...others}>
      <button type="button" onClick={() => setOpen(!open())}>
        Toggle card
      </button>
      <Show when={open()}>
        <div class="body">{props.children}</div>
      </Show>
    </div>
  );
}
