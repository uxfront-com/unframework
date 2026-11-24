import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

export interface DisclosureSlots {
  children?: JSX.Element;
}

export default function Disclosure(
  props: DisclosureSlots &
    Omit<ComponentProps<"div">, "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["children", "class"]);

  const [open, setOpen] = createSignal(false);

  return (
    <div class={props.class ? `disclosure ${props.class}` : "disclosure"} {...others}>
      <button type="button" aria-expanded={open()} onClick={() => setOpen(!open())}>
        Details
      </button>
      <Show when={open()}>
        <div class="body">{props.children}</div>
      </Show>
    </div>
  );
}
