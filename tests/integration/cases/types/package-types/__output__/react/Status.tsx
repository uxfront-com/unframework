import type { CSSProperties } from "react";

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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
