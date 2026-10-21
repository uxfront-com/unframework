import Names from "./Names";
import type { CSSProperties } from "react";

export interface RosterAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Roster({
  names,
  className,
  style,
  ...attributes
}: { names: string[] } & RosterAttributes) {
  return (
    <Names
      names={names}
      className={className}
      style={style}
      renderDefault={({ item }) => <b>{item}!</b>}
      {...scopeAttributes(attributes)}
    />
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
