import { type CSSProperties, useRef, useState } from "react";

export interface SectionAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Section({
  title,
  className,
  style,
}: { title: string } & SectionAttributes) {
  const [nested, setNested] = useState(false);
  const nestedRef = useRef(nested);
  const Tag = nested ? "h3" : "h2";

  return (
    <article className={className} style={style}>
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
