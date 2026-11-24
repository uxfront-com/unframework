import {
  type ComponentProps,
  type JSX,
  createUniqueId,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";

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
    Omit<ComponentProps<"div">, "title" | "onClose" | "style" | "onKeyDown"> & {
      style?: JSX.CSSProperties;
      onKeyDown?: Extract<ComponentProps<"div">["onKeyDown"], (event: never) => void>;
    },
) {
  const [, others] = splitProps(props, ["title", "onConfirm", "onClose", "class", "onKeyDown"]);

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
      onKeyDown={(event) => {
        onKeydown(event);
        props.onKeyDown?.(event);
      }}
      {...others}
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
