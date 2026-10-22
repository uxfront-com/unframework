import { type JSX, Show, createSignal, onCleanup } from "solid-js";

export interface ShippingDetailsEvents {
  onToggled?: (items: number) => void;
}

export default function ShippingDetails(
  props: ShippingDetailsEvents & { class?: string; style?: JSX.CSSProperties },
) {
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
      style={props.style}
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
}
