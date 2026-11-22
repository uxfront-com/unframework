import Panel from "./Panel";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useRef, useState } from "react";

export interface BoardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Board({ className, style, ...attributes }: BoardAttributes) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(shown);

  return (
    <main className={cx("board", className)} style={style} {...scopeAttributes(attributes)}>
      <button
        type="button"
        onClick={() => {
          shownRef.current = false;
          setShown(shownRef.current);
        }}
      >
        Remove panel
      </button>
      {shown ? <Panel /> : null}
    </main>
  );
}
