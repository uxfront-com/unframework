import Names from "./Names";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
      {...scopeAttributes(attributes)}
      renderDefault={({ item }) => <b>{item}!</b>}
    />
  );
}
