import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export default function ContactForm(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [name, setName] = createState("Ada");
  const [email, setEmail] = createState("");

  return (
    <form aria-label="Contact" {...props}>
      <label>
        Name <input value={name()} onInput={(event) => setName(event.currentTarget.value)} />
      </label>
      <label>
        Email{" "}
        <input
          type="email"
          value={email()}
          onInput={(event) => setEmail(event.currentTarget.value)}
        />
      </label>
      <output>
        {name()} at {email() || "no address"}
      </output>
      <button type="button" onClick={() => setName("Grace")}>
        Use Grace
      </button>
    </form>
  );
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
