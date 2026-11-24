import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

export type TagListAttributes = Omit<
  ComponentPropsWithRef<"div">,
  "label" | "tags" | "states" | "extra" | "children"
>;

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
    <div className={cx("tag-list", className)} style={style} {...attributes}>
      <span className={cx("tag", tags, states, { "tag-open": expanded })}>{label}</span>
      <span className={cx(tags)}>Plain</span>
      <span className={cx(extra, expanded ? ["tag-wide", "tag-tall"] : [])}>Extra</span>
      <button type="button" onClick={expand}>
        Expand
      </button>
    </div>
  );
}
