import Panel from "./Panel";
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
