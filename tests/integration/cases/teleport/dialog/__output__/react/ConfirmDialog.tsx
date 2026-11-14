import {
  type CSSProperties,
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

export interface ConfirmDialogAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ConfirmDialog({
  title,
  onConfirm,
  onClose,
  className,
  style,
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
      onKeyDown={onKeydown}
      style={style}
      {...scopeAttributes(attributes)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
