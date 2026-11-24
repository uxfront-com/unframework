import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";

export interface CardSlots {
  children?: ReactNode;
}

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Card({
  children,
  className,
  style,
  ...attributes
}: CardSlots & CardAttributes) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  return (
    <div className={cx("card", className)} style={style} {...scopeAttributes(attributes)}>
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
