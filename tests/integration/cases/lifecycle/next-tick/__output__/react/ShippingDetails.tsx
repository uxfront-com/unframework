import { cx } from "./_unframework/cx";
import { useNextTick } from "./_unframework/useNextTick";
import { type ComponentPropsWithRef, useLayoutEffect, useRef, useState } from "react";

export interface ShippingDetailsEvents {
  onToggled?: (items: number) => void;
}

export type ShippingDetailsAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "onToggled" | "children"
>;

export default function ShippingDetails({
  onToggled,
  className,
  style,
  ...attributes
}: ShippingDetailsEvents & ShippingDetailsAttributes) {
  const onToggledRef = useRef(onToggled);
  useLayoutEffect(() => {
    onToggledRef.current = onToggled;
  });

  const nextTick = useNextTick();
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  const details = useRef<HTMLUListElement>(null);

  async function toggle() {
    openRef.current = !openRef.current;
    setOpen(openRef.current);
    await nextTick();
    onToggledRef.current?.(details.current?.childElementCount ?? 0);
  }

  return (
    <section
      className={cx("shipping-details", className)}
      aria-label="Shipping"
      style={style}
      {...attributes}
    >
      <button type="button" aria-expanded={open} onClick={toggle}>
        Shipping details
      </button>
      {open ? (
        <ul ref={details}>
          <li>Ships in two days</li>
          <li>Free returns</li>
          <li>Tracked delivery</li>
        </ul>
      ) : null}
    </section>
  );
}
