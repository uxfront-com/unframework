import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface DeleteFileProps {
  fileName: string;
}

export interface DeleteFileEvents {
  onDeleted$?: QRL<(fileName: string, copies: number) => void>;
}

export default component$<
  DeleteFileProps & DeleteFileEvents & { class?: ClassList; style?: CSSProperties }
>(({ fileName, onDeleted$, class: className, style }) => {
  const copies = useSignal(1);
  const confirming = useSignal(false);
  const resolveConfirmation = useSignal<(() => void) | undefined>();

  const requestDelete = $(async () => {
    confirming.value = true;
    await new Promise<void>((resolve) => {
      resolveConfirmation.value = resolve;
    });
    confirming.value = false;
    onDeleted$?.(fileName, copies.value);
  });

  const addCopy = $(() => {
    copies.value += 1;
  });

  const confirmDelete = $(() => {
    resolveConfirmation.value?.();
  });

  return (
    <section class={["delete-file", className]} aria-label="File" style={style}>
      <p>
        {fileName}, {copies.value} {copies.value === 1 ? "copy" : "copies"}
      </p>
      <button type="button" onClick$={addCopy}>
        Add a copy
      </button>
      {confirming.value ? (
        <button type="button" onClick$={confirmDelete}>
          Confirm the deletion
        </button>
      ) : (
        <button type="button" onClick$={requestDelete}>
          Delete
        </button>
      )}
    </section>
  );
});
