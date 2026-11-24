import Panel from "./Panel";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type BoardAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Board({ className, style, ...attributes }: BoardAttributes) {
  const [showA, setShowA] = useState(true);
  const showARef = useRef(showA);
  const [showB, setShowB] = useState(true);
  const showBRef = useRef(showB);
  const [entries, setEntries] = useState<string[]>([]);
  const entriesRef = useRef(entries);

  function record(entry: string) {
    entriesRef.current = [...entriesRef.current, entry];
    setEntries(entriesRef.current);
  }

  return (
    <div className={cx("board", className)} style={style} {...attributes}>
      {showA ? <Panel name="a" onClosed={record} /> : null}
      {showB ? <Panel name="b" onClosed={record} /> : null}
      <button
        type="button"
        onClick={() => {
          showARef.current = false;
          setShowA(showARef.current);
        }}
      >
        Hide a
      </button>
      <button
        type="button"
        onClick={() => {
          showBRef.current = false;
          setShowB(showBRef.current);
        }}
      >
        Hide b
      </button>
      <output>{entries.join(", ")}</output>
    </div>
  );
}
