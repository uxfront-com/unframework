import { type JSX, createUniqueId, onCleanup, onMount } from "solid-js";

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

  onMount(() => {
    cancel?.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") props.onClose?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      class={props.class ? `dialog ${props.class}` : "dialog"}
      onKeyDown={onKeydown}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2 id={titleId}>{props.title}</h2>
      <button
        type="button"
        ref={(element) => {
          cancel = element;
          onCleanup(() => {
            cancel = null;
          });
        }}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
