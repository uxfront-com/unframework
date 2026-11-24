import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export interface DisclosureModels {
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
}

export default function Disclosure(
  props: { title: string } & DisclosureModels &
    Omit<ComponentProps<"div">, "title" | "open" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "open", "onOpenChange", "class");

  const [localOpen, setLocalOpen] = createState<boolean>(false);
  const open = () => (props.open === undefined ? localOpen() : props.open);

  function setOpen(next: boolean) {
    setLocalOpen(next);
    props.onOpenChange?.(next);
  }

  return (
    <div class={props.class ? `disclosure ${props.class}` : "disclosure"} {...others}>
      <button
        type="button"
        aria-expanded={enumeratedValue(open())}
        onClick={() => setOpen(!open())}
      >
        {props.title}
      </button>
      <Show when={open()}>
        <p>Details of {props.title}</p>
      </Show>
    </div>
  );
}
