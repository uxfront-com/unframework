import Tag from "./Tag";
import { type CSSProperties, useRef, useState } from "react";

export interface TagsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tags({ className, style }: TagsAttributes) {
  const [active, setActive] = useState(false);
  const activeRef = useRef(active);

  return (
    <div className={cx("tags", className)} style={style}>
      <Tag label="plain" />
      <Tag label="wide" className="wide" style={{ marginLeft: "8px" }} />
      <Tag
        label="toggled"
        className={cx("picked", { active })}
        style={{ color: active ? "rgb(200, 0, 0)" : undefined }}
      />
      <button
        type="button"
        onClick={() => {
          activeRef.current = !activeRef.current;
          setActive(activeRef.current);
        }}
      >
        Toggle
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
