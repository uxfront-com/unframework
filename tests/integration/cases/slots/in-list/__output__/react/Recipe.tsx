import Steps from "./Steps";
import type { CSSProperties } from "react";

export interface RecipeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Recipe({
  steps,
  className,
  style,
}: { steps: string[] } & RecipeAttributes) {
  return (
    <div className={className} style={style}>
      <Steps steps={steps} marker={<span aria-hidden="true">&gt; </span>} />
    </div>
  );
}
