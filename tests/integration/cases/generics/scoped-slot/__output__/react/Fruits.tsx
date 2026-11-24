import Picker from "./Picker";
import type { ComponentPropsWithRef } from "react";

interface Fruit {
  name: string;
  count: number;
}

export type FruitsAttributes = Omit<
  ComponentPropsWithRef<typeof Picker>,
  "fruits" | "children" | "items" | "renderItem"
>;

export default function Fruits({
  fruits,
  className,
  style,
  ...attributes
}: { fruits: Fruit[] } & FruitsAttributes) {
  return (
    <Picker
      items={fruits}
      className={className}
      style={style}
      {...attributes}
      renderItem={({ item }) => (
        <span>
          {item.name} × {item.count}
        </span>
      )}
    />
  );
}
