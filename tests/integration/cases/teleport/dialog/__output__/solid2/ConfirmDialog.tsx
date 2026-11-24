import { clearedRef } from "./_unframework/clearedRef";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createUniqueId, omit, onSettled } from "solid-js";

export interface ConfirmDialogProps {
  title: string;
}

export interface ConfirmDialogEvents {
  onConfirm?: () => void;
  onClose?: () => void;
}

export default function ConfirmDialog(
  props: ConfirmDialogProps &
    ConfirmDialogEvents &
    Omit<ComponentProps<"div">, "title" | "onClose" | "class" | "style" | "onKeyDown"> & {
      class?: string;
      style?: JSX.CSSProperties;
      onKeyDown?: Extract<ComponentProps<"div">["onKeyDown"], (event: never) => void>;
    },
) {
  const others = omit(props, "title", "onConfirm", "onClose", "class", "onKeyDown");

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
      onKeyDown={(event) => {
        onKeydown(event);
        props.onKeyDown?.(event);
      }}
      {...others}
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
