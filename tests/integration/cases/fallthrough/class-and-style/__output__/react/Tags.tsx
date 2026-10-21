import Tag from "./Tag";
import { type CSSProperties, useRef, useState } from "react";

export interface TagsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tags({ className, style, ...attributes }: TagsAttributes) {
  const [active, setActive] = useState(false);
  const activeRef = useRef(active);

  return (
    <div className={cx("tags", className)} style={style} {...scopeAttributes(attributes)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
