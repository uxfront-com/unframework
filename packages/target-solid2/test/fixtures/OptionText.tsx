import type { JSX } from "@solidjs/web";
import { createEffect, createSignal, getObserver, onCleanup } from "solid-js";

export default function OptionText(
  props: { unit: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const [amount, setAmount] = createState("2 kg");

  return (
    <select
      aria-label="Amount"
      onChange={(event) => setAmount(event.currentTarget.value)}
      ref={selectOptions(amount)}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <option
        selected={
          amount() ===
          String("  1 " + props.unit)
            .replace(/[\t\n\f\r ]+/g, " ")
            .replace(/^ | $/g, "")
        }
      >
        {"  1 "}
        {props.unit}
      </option>
      <option
        selected={
          amount() ===
          String("  2 " + props.unit + " ")
            .replace(/[\t\n\f\r ]+/g, " ")
            .replace(/^ | $/g, "")
        }
      >
        {"  2 "}
        {props.unit}{" "}
      </option>
    </select>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/**
 * The `ref` of a `<select>` whose options that hold `value`, or a value of it for an array, it
 * selects, and none where none holds it: as the value changes, and as options come and go.
 */
function selectOptions(value: () => unknown): (select: HTMLSelectElement) => void {
  let bound: HTMLSelectElement | undefined;
  let observer: MutationObserver | undefined;
  const choose = (current: unknown) => {
    const select = bound;
    if (!select) return;
    if (!Array.isArray(current)) {
      // `selectedIndex` -1 where no option holds it: unselecting each one selects the first.
      select.selectedIndex = [...select.options].findIndex(
        (option) => option.value === String(current),
      );
      return;
    }
    for (const option of select.options) option.selected = current.includes(option.value);
  };
  // Created here, as the `ref` is evaluated: Solid 2 creates no computation in a `ref` callback.
  createEffect(value, choose);
  onCleanup(() => observer?.disconnect());
  return (select) => {
    bound = select;
    observer = new MutationObserver(() => choose(value()));
    observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  };
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
