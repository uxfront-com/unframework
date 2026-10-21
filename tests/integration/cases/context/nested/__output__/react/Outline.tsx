import Level from "./Level";
import type { CSSProperties } from "react";

export interface OutlineAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Outline({ className, style, ...attributes }: OutlineAttributes) {
  return (
    <Level title="Book" className={className} style={style} {...scopeAttributes(attributes)}>
      <Level title="Part">
        <Level title="Chapter" />
      </Level>
      <Level title="Appendix" />
    </Level>
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
