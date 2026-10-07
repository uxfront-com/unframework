import { useLayoutEffect, useRef, useState } from "react";

export interface DeleteFileProps {
  fileName: string;
}

export interface DeleteFileEvents {
  onDeleted?: (fileName: string, copies: number) => void;
}

export default function DeleteFile({ fileName, onDeleted }: DeleteFileProps & DeleteFileEvents) {
  const fileNameRef = useRef(fileName);
  const onDeletedRef = useRef(onDeleted);
  useLayoutEffect(() => {
    fileNameRef.current = fileName;
    onDeletedRef.current = onDeleted;
  });

  const [copies, setCopies] = useState(1);
  const copiesRef = useRef(copies);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(confirming);
  const resolveConfirmation = useRef<(() => void) | undefined>(undefined);

  async function requestDelete() {
    confirmingRef.current = true;
    setConfirming(confirmingRef.current);
    await new Promise<void>((resolve) => {
      resolveConfirmation.current = resolve;
    });
    confirmingRef.current = false;
    setConfirming(confirmingRef.current);
    onDeletedRef.current?.(fileNameRef.current, copiesRef.current);
  }

  function addCopy() {
    copiesRef.current += 1;
    setCopies(copiesRef.current);
  }

  function confirmDelete() {
    resolveConfirmation.current?.();
  }

  return (
    <section className="delete-file" aria-label="File">
      <p>
        {fileName}, {copies} {copies === 1 ? "copy" : "copies"}
      </p>
      <button type="button" onClick={addCopy}>
        Add a copy
      </button>
      {confirming ? (
        <button key={0} type="button" onClick={confirmDelete}>
          Confirm the deletion
        </button>
      ) : (
        <button key={1} type="button" onClick={requestDelete}>
          Delete
        </button>
      )}
    </section>
  );
}
