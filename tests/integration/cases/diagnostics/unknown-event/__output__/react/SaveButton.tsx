import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface SaveButtonEvents {
  onSave?: () => void;
}

export interface SaveButtonAttributes {
  className?: string;
  style?: CSSProperties;
}

export function SaveButton({
  onSave,
  className,
  style,
  ...attributes
}: SaveButtonEvents & SaveButtonAttributes) {
  return (
    <button
      type="button"
      onClick={() => onSave?.()}
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      Save
    </button>
  );
}
