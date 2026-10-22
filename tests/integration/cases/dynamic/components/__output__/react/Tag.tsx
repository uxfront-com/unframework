import Card from "./Card";
import Chip from "./Chip";
import { type CSSProperties, useRef, useState } from "react";

export interface TagAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tag({
  label,
  className,
  style,
  ...attributes
}: { label: string } & TagAttributes) {
  const [compact, setCompact] = useState(true);
  const compactRef = useRef(compact);
  const Tag_1 = compact ? Chip : Card;

  return (
    <section aria-label="Tag" className={className} style={style} {...scopeAttributes(attributes)}>
      <Tag_1 label={label} />
      <button
        type="button"
        onClick={() => {
          compactRef.current = !compactRef.current;
          setCompact(compactRef.current);
        }}
      >
        {compact ? "Expand" : "Compact"}
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
