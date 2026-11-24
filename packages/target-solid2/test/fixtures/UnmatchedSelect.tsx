import type { ComponentProps, JSX } from "@solidjs/web";
import { createEffect, createSignal, getObserver, onCleanup } from "solid-js";

export default function UnmatchedSelect(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [size, setSize] = createState("xl");

  return (
    <form {...props}>
      <select
        aria-label="Size"
        onChange={(event) => setSize(event.currentTarget.value)}
        ref={selectOptions(size)}
      >
        <option value="s" selected={size() === "s"}>
          S
        </option>
        <option value="m" selected={size() === "m"}>
          M
        </option>
      </select>
      <button type="button" onClick={() => setSize("m")}>
        M
      </button>
      <button type="button" onClick={() => setSize("xs")}>
        XS
      </button>
    </form>
  );
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
