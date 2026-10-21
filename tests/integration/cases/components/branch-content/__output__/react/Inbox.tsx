import Notice from "./Notice";
import { type CSSProperties, useRef, useState } from "react";

export interface InboxAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Inbox({
  unread,
  className,
  style,
  ...attributes
}: { unread: number } & InboxAttributes) {
  const [count, setCount] = useState(unread);
  const countRef = useRef(count);

  return (
    <div className={cx("inbox", className)} style={style} {...scopeAttributes(attributes)}>
      {count > 0 ? (
        <Notice text={`${count} unread`} tone="info" />
      ) : (
        <Notice text="All read" tone="quiet" />
      )}
      <button
        type="button"
        onClick={() => {
          countRef.current = 0;
          setCount(countRef.current);
        }}
      >
        Mark all read
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
