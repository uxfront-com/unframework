import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

export interface DisclosureModels {
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
}

export default function Disclosure(
  props: { title: string } & DisclosureModels &
    Omit<ComponentProps<"div">, "title" | "open" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["title", "open", "onOpenChange", "class"]);

  const [localOpen, setLocalOpen] = createSignal<boolean>(false);
  const open = () => (props.open === undefined ? localOpen() : props.open);

  function setOpen(next: boolean) {
    setLocalOpen(next);
    props.onOpenChange?.(next);
  }

  return (
    <div class={props.class ? `disclosure ${props.class}` : "disclosure"} {...others}>
      <button type="button" aria-expanded={open()} onClick={() => setOpen(!open())}>
        {props.title}
      </button>
      <Show when={open()}>
        <p>Details of {props.title}</p>
      </Show>
    </div>
  );
}
