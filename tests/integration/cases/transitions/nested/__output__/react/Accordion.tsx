import { Transition } from "./_unframework/Transition";
import { type ComponentPropsWithRef, useRef, useState } from "react";
import "./Accordion.uf.tsx.css";

export type AccordionAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Accordion({ className, style, ...attributes }: AccordionAttributes) {
  const [open, setOpen] = useState(true);
  const openRef = useRef(open);

  return (
    <section
      aria-label="Shipping"
      className={className}
      style={style}
      data-uf-357b6b1f=""
      {...attributes}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          openRef.current = !openRef.current;
          setOpen(openRef.current);
        }}
        data-uf-357b6b1f=""
      >
        Shipping
      </button>
      <Transition name="outer">
        {open ? (
          <div key={0} className="panel" data-uf-357b6b1f="">
            <Transition name="inner">
              <p className="note" data-uf-357b6b1f="">
                Ships in two days.
              </p>
            </Transition>
          </div>
        ) : null}
      </Transition>
    </section>
  );
}
