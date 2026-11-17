import type { JSX } from "@solidjs/web";
import { createSignal, getObserver, onCleanup, onSettled } from "solid-js";

export interface ArticlePreviewProps {
  title: string;
  text: string;
}

export interface ArticlePreviewEvents {
  onReady?: (characters: number) => void;
}

export default function ArticlePreview(
  props: ArticlePreviewProps & ArticlePreviewEvents & { class?: string; style?: JSX.CSSProperties },
) {
  let body: HTMLParagraphElement | null = null;
  const [characters, setCharacters] = createState(0);
  const [counted, setCounted] = createState(false);

  onSettled(() => {
    const length = body?.textContent?.length ?? 0;
    setCharacters(length);
    setCounted(true);
    props.onReady?.(length);
  });

  return (
    <article
      class={props.class ? `article-preview ${props.class}` : "article-preview"}
      aria-label={props.title}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{props.title}</h2>
      <p
        ref={clearedRef(
          (element) => {
            body = element;
          },
          () => {
            body = null;
          },
        )}
      >
        {props.text}
      </p>
      <p role="status">{counted() ? `${characters()} characters` : "Counting the characters"}</p>
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
