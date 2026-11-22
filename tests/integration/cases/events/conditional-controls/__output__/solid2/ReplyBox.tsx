import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export default function ReplyBox(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [started, setStarted] = createState(false);
  const [suggesting, setSuggesting] = createState(false);
  const [accepted, setAccepted] = createState(0);

  function accept(event: KeyboardEvent) {
    event.preventDefault();
    setSuggesting(false);
    setAccepted(accepted() + 1);
  }

  return (
    <section
      class={props.class ? `reply-box ${props.class}` : "reply-box"}
      aria-label="Reply"
      {...others}
    >
      <label>
        Message
        <textarea
          name="message"
          ref={(element) =>
            element.addEventListener(
              "keydown",
              (event) => {
                if (event.key === "Enter") event.preventDefault();
                setStarted(true);
              },
              { once: true },
            )
          }
        />
      </label>
      <p>{started() ? "Started" : "Not started"}</p>
      <label>
        Answer
        <textarea
          name="answer"
          ref={(element) =>
            element.addEventListener("keydown", (event) => {
              if (suggesting() && event.key === "Enter") accept(event);
            })
          }
        />
      </label>
      <button
        type="button"
        aria-pressed={enumeratedValue(suggesting())}
        onClick={() => setSuggesting(!suggesting())}
      >
        Suggestions
      </button>
      <p>Accepted: {accepted()}</p>
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
