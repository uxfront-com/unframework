import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface DeleteFileProps {
  fileName: string;
}

export interface DeleteFileEvents {
  onDeleted?: (fileName: string, copies: number) => void;
}

export interface DeleteFileAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function DeleteFile({
  fileName,
  onDeleted,
  className,
  style,
}: DeleteFileProps & DeleteFileEvents & DeleteFileAttributes) {
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
    <section className={cx("delete-file", className)} aria-label="File" style={style}>
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
