import Card from "./Card";
import Chip from "./Chip";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type TagAttributes = Omit<ComponentPropsWithRef<"section">, "label" | "children">;

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
    <section aria-label="Tag" className={className} style={style} {...attributes}>
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
