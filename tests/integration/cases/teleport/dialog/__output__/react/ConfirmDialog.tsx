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
