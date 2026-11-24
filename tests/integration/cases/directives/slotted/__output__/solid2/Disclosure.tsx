import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export interface DisclosureSlots {
  children?: JSX.Element;
}

export default function Disclosure(
  props: DisclosureSlots &
    Omit<ComponentProps<"div">, "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "children", "class");

  const [open, setOpen] = createState(false);

  return (
    <div class={props.class ? `disclosure ${props.class}` : "disclosure"} {...others}>
      <button
        type="button"
        aria-expanded={enumeratedValue(open())}
        onClick={() => setOpen(!open())}
      >
        Details
      </button>
      <Show when={open()}>
        <div class="body">{props.children}</div>
      </Show>
    </div>
  );
}
