import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";

export interface RowsSlots {
  row?: ReactNode;
}

export interface RowsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Rows({ row, className, style, ...attributes }: RowsSlots & RowsAttributes) {
  const [items, setItems] = useState([1, 2]);
  const itemsRef = useRef(items);

  return (
    <div className={cx("rows", className)} style={style} {...scopeAttributes(attributes)}>
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
