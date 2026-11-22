import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, omit, onCleanup, onSettled } from "solid-js";

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
  let menu: HTMLDivElement | null = null;

  function onDocumentClick(event: MouseEvent) {
    const element = menu;
    if (open() && element && !element.contains(event.target as Node)) {
      setOpen(false);
      props.onClosed?.();
    }
  }

  onSettled(() => {
    document.addEventListener("click", onDocumentClick);
  });

  onSettled(() => () => {
    document.removeEventListener("click", onDocumentClick);
  });

  return (
    <section
      class={props.class ? `profile-menu ${props.class}` : "profile-menu"}
      aria-label="Profile"
      {...others}
    >
      <div
        class="menu"
        ref={clearedRef(
          (element_1) => {
            menu = element_1;
          },
          () => {
            menu = null;
          },
        )}
      >
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
