import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

export interface DeleteFileProps {
  fileName: string;
}

export interface DeleteFileEvents {
  onDeleted?: (fileName: string, copies: number) => void;
}

export default function DeleteFile(
  props: DeleteFileProps &
    DeleteFileEvents &
    Omit<ComponentProps<"section">, "fileName" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["fileName", "onDeleted", "class"]);

  const [copies, setCopies] = createSignal(1);
  const [confirming, setConfirming] = createSignal(false);
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
