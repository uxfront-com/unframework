import { nextTick } from "./_unframework/nextTick";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface ShippingDetailsEvents {
  onToggled$?: QRL<(items: number) => void>;
}

export default component$<
  ShippingDetailsEvents &
    Omit<PropsOf<"section">, "onToggled$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ onToggled$, class: className, style, ...attributes }) => {
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
      style={style}
      {...attributes}
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
});

/**
 * The element a template ref holds while it is in the document, else `null`: Qwik keeps a
 * removed element in its ref, where a template ref is empty once its element is gone (ADR-0049).
 */
function rendered<T extends Element>(element: T | undefined): T | null {
  return element?.isConnected ? element : null;
}
