import { type CSSProperties, useRef, useState } from "react";

export interface SectionAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Section({
  title,
  className,
  style,
  ...attributes
}: { title: string } & SectionAttributes) {
  const [nested, setNested] = useState(false);
  const nestedRef = useRef(nested);
  const Tag = nested ? "h3" : "h2";

  return (
    <article className={className} style={style} {...scopeAttributes(attributes)}>
      <Tag className="title">{title}</Tag>
      <button
        type="button"
        onClick={() => {
          nestedRef.current = !nestedRef.current;
          setNested(nestedRef.current);
        }}
      >
        {nested ? "Lift" : "Nest"}
      </button>
    </article>
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
