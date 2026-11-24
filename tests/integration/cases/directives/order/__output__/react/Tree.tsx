import Note from "./Note";
import { cx } from "./_unframework/cx";
import { mergeRefs } from "./_unframework/mergeRefs";
import { useDirective } from "./_unframework/useDirective";
import { type ComponentPropsWithRef, useMemo, useRef, useState } from "react";

export type TreeAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

const TRACE = "directive-trace";

const vTrace = {
  mounted(el: HTMLElement, value: string) {
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }));
  },
  unmounted(el: HTMLElement) {
    const call = `unmounted ${el.getAttribute("data-name")}`;
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
  },
};

export default function Tree({ className, style, ref, ...attributes }: TreeAttributes) {
  const [shown, setShown] = useState(true);
  const shownRef = useRef(shown);
  const traceRef = useDirective(vTrace, () => "first");
  const traceRef_1 = useDirective(vTrace, () => "leaf");
  const traceRef_2 = useDirective(vTrace, () => "branch");
  const traceRef_3 = useDirective(vTrace, () => "placeholder");
  const traceRef_4 = useDirective(vTrace, () => "last");
  const traceRef_5 = useDirective(vTrace, () => "outer");

  const rootRef = useMemo(() => mergeRefs(traceRef_5, ref), [traceRef_5, ref]);

  return (
    <section
      className={cx("tree", className)}
      aria-label="Tree"
      data-name="outer"
      ref={rootRef}
      style={style}
      {...attributes}
    >
      <p data-name="first" ref={traceRef}>
        First
      </p>
      <Note />
      {shown ? (
        <div className="branch" data-name="branch" ref={traceRef_2}>
          <span data-name="leaf" ref={traceRef_1}>
            Leaf
          </span>
        </div>
      ) : (
        <p data-name="placeholder" ref={traceRef_3}>
          Placeholder
        </p>
      )}
      <p data-name="last" ref={traceRef_4}>
        Last
      </p>
      <button
        type="button"
        onClick={() => {
          shownRef.current = !shownRef.current;
          setShown(shownRef.current);
        }}
      >
        Toggle
      </button>
    </section>
  );
}
