import type { JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, onCleanup } from "solid-js";

export interface ShippingDetailsEvents {
  onToggled?: (items: number) => void;
}

export default function ShippingDetails(
  props: ShippingDetailsEvents & { class?: string; style?: JSX.CSSProperties },
) {
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
      style={props.style}
      {...scopeAttributes(props)}
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

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
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

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
