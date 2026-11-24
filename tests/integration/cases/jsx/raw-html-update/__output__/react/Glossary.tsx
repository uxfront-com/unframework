import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useMemo, useRef, useState } from "react";

export interface GlossaryProps {
  terms: string[];
  definitions: string[];
}

export type GlossaryAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "terms" | "definitions" | "children"
>;

export default function Glossary({
  terms,
  definitions,
  className,
  style,
  ...attributes
}: GlossaryProps & GlossaryAttributes) {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(index);
  const definition = useMemo(() => definitions[index] ?? "", [definitions, index]);

  function next() {
    indexRef.current = (indexRef.current + 1) % terms.length;
    setIndex(indexRef.current);
  }

  return (
    <section
      className={cx("glossary", className)}
      aria-label="Glossary"
      style={style}
      {...attributes}
    >
      <h2>{terms[index]}</h2>
      <div className="definition" dangerouslySetInnerHTML={{ __html: definition }} />
      <button type="button" onClick={next}>
        Next term
      </button>
    </section>
  );
}
