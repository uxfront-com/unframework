import type { ComponentPropsWithRef } from "react";

export interface SaveButtonEvents {
  onSave?: () => void;
}

export type SaveButtonAttributes = Omit<ComponentPropsWithRef<"button">, "onSave" | "children">;

export function SaveButton({
  onSave,
  className,
  style,
  onClick,
  ...attributes
}: SaveButtonEvents & SaveButtonAttributes) {
  return (
    <button
      type="button"
      onClick={(event) => {
        onSave?.();
        onClick?.(event);
      }}
      className={className}
      style={style}
      {...attributes}
    >
      Save
    </button>
  );
}
