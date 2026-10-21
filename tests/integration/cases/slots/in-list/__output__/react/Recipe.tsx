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
  ...attributes
}: { steps: string[] } & RecipeAttributes) {
  return (
    <div className={className} style={style} {...scopeAttributes(attributes)}>
      <Steps steps={steps} marker={<span aria-hidden="true">&gt; </span>} />
    </div>
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
