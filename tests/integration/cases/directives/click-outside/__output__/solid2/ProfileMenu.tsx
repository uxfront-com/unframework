import { vClickOutside } from "./vClickOutside";
import type { JSX } from "@solidjs/web";
import { Show, createSignal, getObserver } from "solid-js";

export interface ProfileMenuEvents {
  onClosed?: () => void;
}

export default function ProfileMenu(
  props: ProfileMenuEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [open, setOpen] = createState(false);

  function close() {
    if (!open()) return;
    setOpen(false);
    props.onClosed?.();
  }

  return (
    <section
      class={props.class ? `profile-menu ${props.class}` : "profile-menu"}
      aria-label="Profile"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <div class="menu" ref={vClickOutside(() => close)}>
        <button
          type="button"
          aria-expanded={enumeratedValue(open())}
          onClick={() => setOpen(!open())}
        >
          Account
        </button>
        <Show when={open()}>
          <ul aria-label="Account actions">
            <li>
              <button type="button">Settings</button>
            </li>
            <li>
              <button type="button">Sign out</button>
            </li>
          </ul>
        </Show>
      </div>
      <p>Outside the menu</p>
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
