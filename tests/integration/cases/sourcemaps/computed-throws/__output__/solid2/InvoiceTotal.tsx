import type { JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export interface InvoiceTotalProps {
  quantity: number;
}

export default function InvoiceTotal(
  props: InvoiceTotalProps & { class?: string; style?: JSX.CSSProperties },
) {
  const [refunded, setRefunded] = createState(0);
  const total = () => {
    const units = props.quantity - refunded();
    if (units < 0) {
      throw new Error("The total is negative");
    }
    return units * 5;
  };

  function refund() {
    setRefunded(refunded() + 3);
  }

  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
      <output>{`${total()} after ${refunded()} refunded`}</output>
      <button type="button" onClick={refund}>
        Refund
      </button>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
