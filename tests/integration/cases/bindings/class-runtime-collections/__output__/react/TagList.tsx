import { type CSSProperties, useRef, useState } from "react";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

export interface TagListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function TagList({
  label,
  tags,
  states,
  extra,
  className,
  style,
  ...attributes
}: TagListProps & TagListAttributes) {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);

  function expand() {
    expandedRef.current = !expandedRef.current;
    setExpanded(expandedRef.current);
  }

  return (
    <div className={cx("tag-list", className)} style={style} {...scopeAttributes(attributes)}>
      <span className={cx("tag", tags, states, { "tag-open": expanded })}>{label}</span>
      <span className={cx(tags)}>Plain</span>
      <span className={cx(extra, expanded ? ["tag-wide", "tag-tall"] : [])}>Extra</span>
      <button type="button" onClick={expand}>
        Expand
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
    } else if (Array.isArray(part)) {
      const joined = cx(...part);
      if (joined) names.push(joined);
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
