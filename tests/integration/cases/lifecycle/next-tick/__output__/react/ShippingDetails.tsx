import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

export interface ShippingDetailsEvents {
  onToggled?: (items: number) => void;
}

export default function ShippingDetails({ onToggled }: ShippingDetailsEvents) {
  const onToggledRef = useRef(onToggled);
  useLayoutEffect(() => {
    onToggledRef.current = onToggled;
  });

  const nextTick = useNextTick();
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const details = useRef<HTMLUListElement>(null);

  async function toggle() {
    openRef.current = !openRef.current;
    setOpen(openRef.current);
    await nextTick();
    onToggledRef.current?.(details.current?.childElementCount ?? 0);
  }

  return (
    <section className="shipping-details" aria-label="Shipping">
      <button type="button" aria-expanded={open} onClick={toggle}>
        Shipping details
      </button>
      {open ? (
        <ul ref={details}>
          <li>Ships in two days</li>
          <li>Free returns</li>
          <li>Tracked delivery</li>
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Vue's `nextTick` for one component: the promise resolves once React has rendered the writes
 * made before it and run their effects, and `settled` says nothing they wrote waits to render;
 * in the task of a click or a key that wrote, as on Vue. It resolves when the component unmounts
 * too.
 */
function useNextTick(settled: () => boolean = () => true): () => Promise<void> {
  const pending = useRef<{ ticket: number; resolve: () => void }[]>([]);
  const tickets = useRef(0);
  const mounted = useRef(false);
  const [rendered, render] = useReducer(
    (last: number, ticket: number) => Math.max(last, ticket),
    0,
  );
  useEffect(() => {
    if (!pending.current.length) return;
    // Once every effect of the commit has run.
    queueMicrotask(() => {
      if (!settled()) {
        // What the component's effects wrote has yet to render, and may end where it was, when
        // React commits nothing: a render of its own makes the next look certain.
        tickets.current += 1;
        render(tickets.current);
        return;
      }
      const due = pending.current.filter(({ ticket }) => ticket <= rendered);
      pending.current = pending.current.filter(({ ticket }) => ticket > rendered);
      for (const { resolve } of due) resolve();
    });
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (mounted.current) return;
        const due = pending.current;
        pending.current = [];
        for (const { resolve } of due) resolve();
      });
    };
  }, []);
  return () =>
    new Promise<void>((resolve) => {
      tickets.current += 1;
      const ticket = tickets.current;
      pending.current.push({ ticket, resolve });
      render(ticket);
    });
}
