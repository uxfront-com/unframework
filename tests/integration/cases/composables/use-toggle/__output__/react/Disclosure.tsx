import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useToggle } from "./useToggle";
import type { CSSProperties } from "react";

export interface DisclosureAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Disclosure({ className, style, ...attributes }: DisclosureAttributes) {
  const { on, toggle, close } = useToggle(false);

  return (
    <section
      className={cx("disclosure", className)}
      aria-label="Shipping"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button type="button" aria-expanded={on} onClick={() => toggle()}>
        Shipping details
      </button>
      {on ? (
        <div className="panel">
          <p>Orders ship within two days.</p>
          <button type="button" onClick={() => close()}>
            Close
          </button>
        </div>
      ) : null}
    </section>
  );
}
