import { type JSX, Show, createSignal } from "solid-js";

export interface DisclosureModels {
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
}

export default function Disclosure(
  props: { title: string } & DisclosureModels & { class?: string; style?: JSX.CSSProperties },
) {
  const [localOpen, setLocalOpen] = createSignal<boolean>(false);
  const open = () => (props.open === undefined ? localOpen() : props.open);

  function setOpen(next: boolean) {
    setLocalOpen(next);
    props.onOpenChange?.(next);
  }

  return (
    <div class={props.class ? `disclosure ${props.class}` : "disclosure"} style={props.style}>
      <button type="button" aria-expanded={open()} onClick={() => setOpen(!open())}>
        {props.title}
      </button>
      <Show when={open()}>
        <p>Details of {props.title}</p>
      </Show>
    </div>
  );
}
