import { type ComponentPropsWithRef, type ReactNode, useRef, useState } from "react";

export interface RowsSlots {
  row?: ReactNode;
}

export type RowsAttributes = Omit<ComponentPropsWithRef<"div">, "row" | "children">;

export default function Rows({ row, className, style, ...attributes }: RowsSlots & RowsAttributes) {
  const [items, setItems] = useState([1, 2]);
  const itemsRef = useRef(items);

  return (
    <div className={cx("rows", className)} style={style} {...attributes}>
      <ul>
        {items.map((item) => (
          <li key={item}>{row}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          itemsRef.current = [...itemsRef.current, itemsRef.current.length + 1];
          setItems(itemsRef.current);
        }}
      >
        Add row
      </button>
      <button
        type="button"
        onClick={() => {
          itemsRef.current = itemsRef.current.slice(0, -1);
          setItems(itemsRef.current);
        }}
      >
        Remove row
      </button>
    </div>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
