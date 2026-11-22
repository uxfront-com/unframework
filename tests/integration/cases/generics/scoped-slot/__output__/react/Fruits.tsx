import Picker from "./Picker";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

interface Fruit {
  name: string;
  count: number;
}

export interface FruitsAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
      renderItem={({ item }) => (
        <span>
          {item.name} × {item.count}
        </span>
      )}
    />
  );
}
