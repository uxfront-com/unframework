import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit, onCleanup } from "solid-js";

export interface ListenersEvents {
  onLogged?: (entries: Array<string>) => void;
}

export default function Listeners(
  props: ListenersEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onLogged");

  const [log, setLog] = createState<Array<string>>([]);
  const [volume, setVolume] = createState(0);
  let field: HTMLInputElement | null = null;

  function record(line: string) {
    setLog([...log(), line]);
  }

  function scroll(event: WheelEvent) {
    setVolume(volume() + (event.deltaY < 0 ? 1 : -1));
  }

  function report() {
    record("report");
    props.onLogged?.(log());
  }

  return (
    <section aria-label="Listeners" {...others}>
      <div
        role="presentation"
        ref={(element) => {
          element.addEventListener("click", () => record("capture"), { capture: true });
          element.addEventListener("click", () => record("bubble"));
        }}
      >
        <button
          type="button"
          ref={(element) => element.addEventListener("click", () => record("inside"))}
        >
          Inside
        </button>
        <button
          type="button"
          ref={(element) =>
            element.addEventListener("click", (event) => {
              event.stopPropagation();
              record("stopped");
            })
          }
        >
          Stop
        </button>
        <button
          type="button"
          ref={(element) => element.addEventListener("click", () => record("once"), { once: true })}
        >
          Once
        </button>
      </div>
      <button
        type="button"
        ref={(element) => {
          element.addEventListener("click", () => record("own capture"), { capture: true });
          element.addEventListener("click", report);
        }}
      >
        Report
      </button>
      <button
        type="button"
        ref={(element) => {
          element.addEventListener("click", () => record("plain"));
          element.addEventListener("click", () => record("first"), { once: true });
        }}
      >
        Pair
      </button>
      <button
        type="button"
        ref={(element) => {
          element.addEventListener("click", () => record("first swap"), { once: true });
          element.addEventListener("click", () => record("swap"));
        }}
      >
        Swap
      </button>
      <div
        role="group"
        aria-label="Volume"
        ref={(element) => element.addEventListener("wheel", scroll, { passive: true })}
      >
        <output>{volume()}</output>
      </div>
      <label>
        Name
        <input
          name="name"
          ref={clearedRef(
            (element) => {
              field = element;
              element.addEventListener("keydown", () => record("key capture"), { capture: true });
            },
            () => {
              field = null;
            },
          )}
          onFocus={() => record("focus")}
          onBlur={() => record("blur")}
          onChange={() => record(`change ${field?.value ?? ""}`)}
          onKeyDown={(event) => event.key === "Enter" && record("enter")}
        />
      </label>
      <p>{log().join(", ")}</p>
    </section>
  );
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
    if (getObserver()) {
      tracked();
    }
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) {
      return;
    }
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
