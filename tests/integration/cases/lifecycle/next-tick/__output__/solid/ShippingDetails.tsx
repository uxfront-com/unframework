import { Show, createSignal, onCleanup } from "solid-js";

export interface ShippingDetailsEvents {
  onToggled?: (items: number) => void;
}

export default function ShippingDetails(props: ShippingDetailsEvents) {
  const [open, setOpen] = createSignal(false);
  let details: HTMLUListElement | null = null;

  async function toggle() {
    setOpen(!open());
    await nextTick();
    props.onToggled?.(details?.childElementCount ?? 0);
  }

  return (
    <section class="shipping-details" aria-label="Shipping">
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

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}
