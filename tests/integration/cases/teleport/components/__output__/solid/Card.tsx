import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

export interface CardSlots {
  children?: JSX.Element;
}

export default function Card(
  props: CardSlots &
    Omit<ComponentProps<"div">, "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["children", "class"]);

  const [open, setOpen] = createSignal(false);

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
