import Choice from "./Choice";
import List from "./List";
import Wrapper from "./Wrapper";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useDirective } from "./_unframework/useDirective";
import { vTrace } from "./vTrace";
import { type CSSProperties, useRef, useState } from "react";

export interface PageAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Page({ className, style, ...attributes }: PageAttributes) {
  const [label, setLabel] = useState("first");
  const labelRef = useRef(label);
  const note = useRef<HTMLParagraphElement>(null);
  const [noted, setNoted] = useState("");
  const notedRef = useRef(noted);
  const traceRef = useDirective(vTrace, () => label);
  const traceRef_1 = useDirective(vTrace, () => label);
  const traceRef_2 = useDirective(vTrace, () => label);
  const traceRef_3 = useDirective(vTrace, () => label);

  return (
    <section
      className={cx("page", className)}
      aria-label="Page"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Wrapper
        row={
          <span data-name="row" ref={traceRef}>
            Row
          </span>
        }
      />
      <Choice
        body={
          <em data-name="body" ref={traceRef_1}>
            Body
          </em>
        }
      />
      <List
        items={["a", "b"]}
        renderItem={({ item }) => (
          <strong data-name="item" ref={traceRef_2}>
            {item}
          </strong>
        )}
      />
      <p
        ref={(element) => {
          note.current = element;
          const detach = traceRef_3(element);
          return () => {
            note.current = null;
            detach();
          };
        }}
        data-name="note"
      >
        Note
      </p>
      <output>{noted}</output>
      <button
        type="button"
        onClick={() => {
          notedRef.current = note.current?.getAttribute("data-name") ?? "";
          setNoted(notedRef.current);
        }}
      >
        Check
      </button>
      <button
        type="button"
        onClick={() => {
          labelRef.current = "second";
          setLabel(labelRef.current);
        }}
      >
        Rename
      </button>
    </section>
  );
}
