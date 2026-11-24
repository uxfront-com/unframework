import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";

export interface DisclosureSlots {
  children?: ReactNode;
}

export interface DisclosureAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Disclosure({
  children,
  className,
  style,
  ...attributes
}: DisclosureSlots & DisclosureAttributes) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  return (
    <div className={cx("disclosure", className)} style={style} {...scopeAttributes(attributes)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          openRef.current = !openRef.current;
          setOpen(openRef.current);
        }}
      >
        Details
      </button>
      {open ? <div className="body">{children}</div> : null}
    </div>
  );
}
