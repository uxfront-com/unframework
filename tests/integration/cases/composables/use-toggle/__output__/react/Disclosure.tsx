import { cx } from "./_unframework/cx";
import { useToggle } from "./useToggle";
import type { ComponentPropsWithRef } from "react";

export type DisclosureAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Disclosure({ className, style, ...attributes }: DisclosureAttributes) {
  const { on, toggle, close } = useToggle(false);

  return (
    <section
      className={cx("disclosure", className)}
      aria-label="Shipping"
      style={style}
      {...attributes}
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
