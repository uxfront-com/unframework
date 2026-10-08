import { defineEmits, ref } from "unframework";

export interface DeleteFileProps {
  fileName: string;
}

export default function DeleteFile({ fileName }: DeleteFileProps) {
  const emit = defineEmits<{ deleted: [fileName: string, copies: number] }>();

  const copies = ref(1);
  const confirming = ref(false);
  let resolveConfirmation: (() => void) | undefined;

  async function requestDelete() {
    confirming.value = true;
    await new Promise<void>((resolve) => {
      resolveConfirmation = resolve;
    });
    confirming.value = false;
    emit("deleted", fileName, copies.value);
  }

  function addCopy() {
    copies.value += 1;
  }

  function confirmDelete() {
    resolveConfirmation?.();
  }

  return (
    <section class="delete-file" aria-label="File">
      <p>
        {fileName}, {copies.value} {copies.value === 1 ? "copy" : "copies"}
      </p>
      <button type="button" onClick={addCopy}>
        Add a copy
      </button>
      {confirming.value ? (
        <button type="button" onClick={confirmDelete}>
          Confirm the deletion
        </button>
      ) : (
        <button type="button" onClick={requestDelete}>
          Delete
        </button>
      )}
    </section>
  );
}
