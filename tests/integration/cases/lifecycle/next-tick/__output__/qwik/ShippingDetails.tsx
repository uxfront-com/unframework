import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface ShippingDetailsEvents {
  onToggled$?: QRL<(items: number) => void>;
}

export default component$<ShippingDetailsEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onToggled$, class: className, style, ...attributes }) => {
    const open = useSignal(false);
    const details = useSignal<HTMLUListElement>();

    const toggle = $(async () => {
      open.value = !open.value;
      await nextTick();
      onToggled$?.(rendered(details.value)?.childElementCount ?? 0);
    });

    return (
      <section
        class={["shipping-details", className]}
        aria-label="Shipping"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <button type="button" aria-expanded={open.value} onClick$={toggle}>
          Shipping details
        </button>
        {open.value ? (
          <ul ref={details}>
            <li>Ships in two days</li>
            <li>Free returns</li>
            <li>Tracked delivery</li>
          </ul>
        ) : null}
      </section>
    );
  },
);

/**
 * Resolves once Qwik has rendered the writes made before it: Qwik renders them in a microtask,
 * so they are in the DOM by the next task.
 */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

/**
 * The element a template ref holds while it is in the document, else `null`: Qwik keeps a
 * removed element in its ref, where a template ref is empty once its element is gone (ADR-0049).
 */
function rendered<T extends Element>(element: T | undefined): T | null {
  return element?.isConnected ? element : null;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
