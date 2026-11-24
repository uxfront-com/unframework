import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, type ReactNode, useRef, useState } from "react";

export interface CardSlots {
  children?: ReactNode;
}

export type CardAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Card({
  children,
  className,
  style,
  ...attributes
}: CardSlots & CardAttributes) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  return (
    <div className={cx("card", className)} style={style} {...attributes}>
      <button
        type="button"
        onClick={() => {
          openRef.current = !openRef.current;
          setOpen(openRef.current);
        }}
      >
        Toggle card
      </button>
      {open ? <div className="body">{children}</div> : null}
    </div>
  );
}
