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
}: { names: string[] } & RosterAttributes) {
  return (
    <Names
      names={names}
      className={className}
      style={style}
      renderDefault={({ item }) => <b>{item}!</b>}
    />
  );
}
