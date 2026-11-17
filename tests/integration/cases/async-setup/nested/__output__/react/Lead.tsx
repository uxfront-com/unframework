import Member from "./Member";
import type { CSSProperties } from "react";

export interface LeadAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Lead({
  id,
  className,
  style,
  ...attributes
}: { id: string } & LeadAttributes) {
  return <Member id={id} className={className} style={style} {...scopeAttributes(attributes)} />;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
