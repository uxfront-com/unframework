import Panel from "./Panel";
import { type CSSProperties, useRef, useState } from "react";

export interface BoardAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <div className={cx("board", className)} style={style} {...scopeAttributes(attributes)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
