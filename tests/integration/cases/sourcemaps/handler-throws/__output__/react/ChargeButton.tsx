import type { CSSProperties } from "react";

export interface ChargeButtonAttributes {
  className?: string;
  style?: CSSProperties;
}

function charge() {
  throw new Error("The card was declined");
}

export default function ChargeButton({ className, style, ...attributes }: ChargeButtonAttributes) {
  return (
    <button
      type="button"
      onClick={charge}
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      Charge
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
