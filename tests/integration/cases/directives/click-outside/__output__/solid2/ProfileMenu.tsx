import { vClickOutside } from "./vClickOutside";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, omit } from "solid-js";

export interface ProfileMenuEvents {
  onClosed?: () => void;
}

export default function ProfileMenu(
  props: ProfileMenuEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onClosed", "class");

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
      {...others}
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
