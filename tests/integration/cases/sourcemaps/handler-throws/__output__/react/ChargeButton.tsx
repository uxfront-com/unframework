import { scopeAttributes } from "./_unframework/scopeAttributes";
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
