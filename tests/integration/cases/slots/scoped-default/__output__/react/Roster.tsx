import Names from "./Names";
import type { ComponentPropsWithRef } from "react";

export type RosterAttributes = Omit<
  ComponentPropsWithRef<typeof Names>,
  "names" | "children" | "renderDefault"
>;

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
      {...attributes}
      renderDefault={({ item }) => <b>{item}!</b>}
    />
  );
}
