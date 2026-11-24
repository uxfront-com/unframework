import { cx } from "./_unframework/cx";
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
} from "react";

export interface ConfirmDialogProps {
  title: string;
}

export interface ConfirmDialogEvents {
  onConfirm?: () => void;
  onClose?: () => void;
}

export type ConfirmDialogAttributes = Omit<
  ComponentPropsWithRef<"div">,
  "title" | "onConfirm" | "onClose" | "children"
>;

export default function ConfirmDialog({
  title,
  onConfirm,
  onClose,
  className,
  style,
  onKeyDown,
  ...attributes
}: ConfirmDialogProps & ConfirmDialogEvents & ConfirmDialogAttributes) {
  const titleId = `uf-id-${useId()}`;
  const cancel = useRef<HTMLButtonElement>(null);

  const onMount = useEffectEvent(() => {
    cancel.current?.focus();
  });
  useEffect(() => {
    onMount();
  }, []);

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") onClose?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cx("dialog", className)}
      onKeyDown={(event) => {
        onKeydown(event);
        onKeyDown?.(event);
      }}
      style={style}
      {...attributes}
    >
      <h2 id={titleId}>{title}</h2>
      <button type="button" ref={cancel} onClick={() => onClose?.()}>
        Cancel
      </button>
      <button type="button" onClick={() => onConfirm?.()}>
        Delete
      </button>
    </div>
  );
}
