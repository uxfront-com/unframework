import Picker from "./Picker";
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
