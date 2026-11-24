import Steps from "./Steps";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface RecipeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Recipe({
  steps,
  className,
  style,
  ...attributes
}: { steps: string[] } & RecipeAttributes) {
  return (
    <div className={className} style={style} {...scopeAttributes(attributes)}>
      <Steps steps={steps} marker={<span aria-hidden="true">&gt; </span>} />
    </div>
  );
}
