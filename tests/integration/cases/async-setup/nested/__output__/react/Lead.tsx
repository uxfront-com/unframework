import Member from "./Member";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
