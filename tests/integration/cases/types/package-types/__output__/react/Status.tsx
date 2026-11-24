import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { Labelled } from "./types";
import type { CSSProperties } from "react";
import type { TimeInterval } from "rxjs";

type StatusProps = TimeInterval<string> & Labelled;

export interface StatusAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Status({
  value,
  interval,
  label,
  className,
  style,
  ...attributes
}: StatusProps & StatusAttributes) {
  return (
    <p className={className} style={style} {...scopeAttributes(attributes)}>
      {label}: {value} after {interval} ms
    </p>
  );
}
