import Item from "./Item";
import type { ComponentPropsWithRef } from "react";

export type MenuAttributes = Omit<ComponentPropsWithRef<"ul">, "entries" | "children">;

export default function Menu({
  entries,
  className,
  style,
  ...attributes
}: { entries: string[] } & MenuAttributes) {
  return (
    <ul aria-label="Menu" className={className} style={style} {...attributes}>
      {entries.map((entry) => (
        <Item key={entry} label={entry} />
      ))}
    </ul>
  );
}
