import type { JSX } from "@solidjs/web";
import { createUniqueId, onCleanup, onSettled } from "solid-js";

export interface ConfirmDialogProps {
  title: string;
}

export interface ConfirmDialogEvents {
  onConfirm?: () => void;
  onClose?: () => void;
}

export default function ConfirmDialog(
  props: ConfirmDialogProps & ConfirmDialogEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const titleId = `uf-id-${createUniqueId()}`;
  let cancel: HTMLButtonElement | null = null;

  onSettled(() => {
    cancel?.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") props.onClose?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={enumeratedValue(titleId)}
      tabindex="-1"
      class={props.class ? `dialog ${props.class}` : "dialog"}
      onKeyDown={onKeydown}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2 id={titleId}>{props.title}</h2>
      <button
        type="button"
        ref={clearedRef(
          (element) => {
            cancel = element;
          },
          () => {
            cancel = null;
          },
        )}
        onClick={() => props.onClose?.()}
      >
        Cancel
      </button>
      <button type="button" onClick={() => props.onConfirm?.()}>
        Delete
      </button>
    </div>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
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
