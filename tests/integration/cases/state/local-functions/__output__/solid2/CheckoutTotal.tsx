import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export type ShippingMethod = "standard" | "express";

export interface CheckoutTotalProps {
  /** The order's subtotal, in cents. */
  subtotal: number;
}

export interface CheckoutTotalEvents {
  onShippingChange?: (method: ShippingMethod) => void;
}

const rates = { standard: 0, express: 1200 };

function formatCents(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export default function CheckoutTotal(
  props: CheckoutTotalProps &
    CheckoutTotalEvents &
    Omit<ComponentProps<"section">, "subtotal" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "subtotal", "onShippingChange", "class");

  const [method, setMethod] = createState<ShippingMethod>("standard");
  const shipping = () => rates[method()];
  const total = () => formatCents(props.subtotal + shipping());

  function choose(next: ShippingMethod) {
    setMethod(next);
    props.onShippingChange?.(next);
  }

  const chooseExpress = () => {
    choose("express");
  };

  function chooseStandard() {
    choose("standard");
  }

  return (
    <section
      class={props.class ? `checkout-total ${props.class}` : "checkout-total"}
      aria-label="Order total"
      {...others}
    >
      <p>Subtotal: {formatCents(props.subtotal)}</p>
      <p>Shipping: {formatCents(shipping())}</p>
      <p role="status">Total: {total()}</p>
      <button
        type="button"
        aria-pressed={enumeratedValue(method() === "standard")}
        onClick={chooseStandard}
      >
        Standard shipping
      </button>
      <button
        type="button"
        aria-pressed={enumeratedValue(method() === "express")}
        onClick={chooseExpress}
      >
        Express shipping
      </button>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
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
