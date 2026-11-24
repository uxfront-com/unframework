import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export interface GlossaryProps {
  terms: string[];
  definitions: string[];
}

export default function Glossary(
  props: GlossaryProps &
    Omit<ComponentProps<"section">, "terms" | "definitions" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "terms", "definitions", "class");

  const [index, setIndex] = createState(0);
  const definition = () => props.definitions[index()] ?? "";

  function next() {
    setIndex((index() + 1) % props.terms.length);
  }

  return (
    <section
      class={props.class ? `glossary ${props.class}` : "glossary"}
      aria-label="Glossary"
      {...others}
    >
      <h2>{props.terms[index()]}</h2>
      <div class="definition" innerHTML={definition()} />
      <button type="button" onClick={next}>
        Next term
      </button>
    </section>
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
