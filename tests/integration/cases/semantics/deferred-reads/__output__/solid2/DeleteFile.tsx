import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, omit } from "solid-js";

export interface DeleteFileProps {
  fileName: string;
}

export interface DeleteFileEvents {
  onDeleted?: (fileName: string, copies: number) => void;
}

export default function DeleteFile(
  props: DeleteFileProps &
    DeleteFileEvents &
    Omit<ComponentProps<"section">, "fileName" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "fileName", "onDeleted", "class");

  const [copies, setCopies] = createState(1);
  const [confirming, setConfirming] = createState(false);
  let resolveConfirmation: (() => void) | undefined;

  async function requestDelete() {
    setConfirming(true);
    await new Promise<void>((resolve) => {
      resolveConfirmation = resolve;
    });
    setConfirming(false);
    props.onDeleted?.(props.fileName, copies());
  }

  function addCopy() {
    setCopies(copies() + 1);
  }

  function confirmDelete() {
    resolveConfirmation?.();
  }

  return (
    <section
      class={props.class ? `delete-file ${props.class}` : "delete-file"}
      aria-label="File"
      {...others}
    >
      <p>
        {props.fileName}, {copies()} {copies() === 1 ? "copy" : "copies"}
      </p>
      <button type="button" onClick={addCopy}>
        Add a copy
      </button>
      <Show
        when={confirming()}
        fallback={
          <button type="button" onClick={requestDelete}>
            Delete
          </button>
        }
      >
        <button type="button" onClick={confirmDelete}>
          Confirm the deletion
        </button>
      </Show>
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
