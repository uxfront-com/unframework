import Disclosure from "./Disclosure";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useDirective } from "./_unframework/useDirective";
import { type CSSProperties, useRef, useState } from "react";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

const vTrace = {
  mounted(el: HTMLElement, value: string) {
    const call = `mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el: HTMLElement) {
    const call = `unmounted ${el.getAttribute("data-name")}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
};

export default function Card({ className, style, ...attributes }: CardAttributes) {
  const [note, setNote] = useState<{ name: string } | null>({ name: "note" });
  const noteRef = useRef(note);
  const traceRef = useDirective(vTrace, () => "body");
  const traceRef_1 = useDirective(vTrace, () => note!.name);

  return (
    <section
      className={cx("card", className)}
      aria-label="Card"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Disclosure>
        <p data-name="body" ref={traceRef}>
          Body
        </p>
        {note ? (
          <p data-name="note" ref={traceRef_1}>
            Note
          </p>
        ) : null}
      </Disclosure>
      <button
        type="button"
        onClick={() => {
          noteRef.current = { name: "renamed" };
          setNote(noteRef.current);
        }}
      >
        Rename
      </button>
    </section>
  );
}
