import { Transition } from "./_unframework/Transition";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useRef, useState } from "react";
import "./Panel.uf.tsx.css";

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({ className, style, ...attributes }: PanelAttributes) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  return (
    <section
      className={cx("panel", className)}
      aria-label="Delivery"
      style={style}
      data-uf-eab7eeb4=""
      {...scopeAttributes(attributes)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          openRef.current = !openRef.current;
          setOpen(openRef.current);
        }}
        data-uf-eab7eeb4=""
      >
        Details
      </button>
      <Transition name="v">
        {open ? (
          <p key={0} className="details" data-uf-eab7eeb4="">
            Ships in two days.
          </p>
        ) : null}
      </Transition>
    </section>
  );
}
