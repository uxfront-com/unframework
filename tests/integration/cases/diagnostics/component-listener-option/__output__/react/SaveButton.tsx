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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
