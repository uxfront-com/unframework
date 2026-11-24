import Panel from "./Panel";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type BoardAttributes = Omit<ComponentPropsWithRef<"main">, "children">;

export default function Board({ className, style, ...attributes }: BoardAttributes) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(shown);

  return (
    <main className={cx("board", className)} style={style} {...attributes}>
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
