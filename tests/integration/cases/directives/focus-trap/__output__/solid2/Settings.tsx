import { vFocusTrap } from "./vFocusTrap";
import type { JSX } from "@solidjs/web";
import { Show, createSignal, getObserver } from "solid-js";

export default function Settings(props: { class?: string; style?: JSX.CSSProperties }) {
  const [open, setOpen] = createState(false);

  function close() {
    setOpen(false);
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }

  return (
    <section
      class={props.class ? `settings ${props.class}` : "settings"}
      aria-label="Settings"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Show when={open()}>
        <div
          role="dialog"
          aria-label="Preferences"
          tabindex="-1"
          class="dialog"
          ref={vFocusTrap(() => open())}
          onKeyDown={onKeydown}
        >
          <button type="button">Theme</button>
          <button type="button">Language</button>
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
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
