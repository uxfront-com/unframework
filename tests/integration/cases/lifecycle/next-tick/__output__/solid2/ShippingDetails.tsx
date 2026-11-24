import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import { nextTick } from "./_unframework/nextTick";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export interface ShippingDetailsEvents {
  onToggled?: (items: number) => void;
}

export default function ShippingDetails(
  props: ShippingDetailsEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onToggled", "class");

  const [open, setOpen] = createState(false);
  let details: HTMLUListElement | null = null;

  async function toggle() {
    setOpen(!open());
    await nextTick();
    props.onToggled?.(details?.childElementCount ?? 0);
  }

  return (
    <section
      class={props.class ? `shipping-details ${props.class}` : "shipping-details"}
      aria-label="Shipping"
      {...others}
    >
      <button type="button" aria-expanded={enumeratedValue(open())} onClick={toggle}>
        Shipping details
      </button>
      <Show when={open()}>
        <ul
          ref={clearedRef(
            (element) => {
              details = element;
            },
            () => {
              details = null;
            },
          )}
        >
          <li>Ships in two days</li>
          <li>Free returns</li>
          <li>Tracked delivery</li>
        </ul>
      </Show>
    </section>
  );
}
