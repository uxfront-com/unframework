import { nextTick } from "./_unframework/nextTick";
import { type ComponentProps, type JSX, Show, createSignal, onCleanup, splitProps } from "solid-js";

export interface ShippingDetailsEvents {
  onToggled?: (items: number) => void;
}

export default function ShippingDetails(
  props: ShippingDetailsEvents &
    Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["onToggled", "class"]);

  const [open, setOpen] = createSignal(false);
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
      <button type="button" aria-expanded={open()} onClick={toggle}>
        Shipping details
      </button>
      <Show when={open()}>
        <ul
          ref={(element) => {
            details = element;
            onCleanup(() => {
              details = null;
            });
          }}
        >
          <li>Ships in two days</li>
          <li>Free returns</li>
          <li>Tracked delivery</li>
        </ul>
      </Show>
    </section>
  );
}
