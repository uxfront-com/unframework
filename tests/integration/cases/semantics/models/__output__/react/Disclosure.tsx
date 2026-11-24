import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface DisclosureModels {
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
}

export interface DisclosureAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Disclosure({
  title,
  open: openProp,
  onOpenChange,
  className,
  style,
  ...attributes
}: { title: string } & DisclosureModels & DisclosureAttributes) {
  const [localOpen, setLocalOpen] = useState<{ value: boolean }>({ value: false });
  const open = openProp === undefined ? localOpen.value : openProp;
  const openRef = useRef(open);

  useLayoutEffect(() => {
    openRef.current = open;
  });

  return (
    <div className={cx("disclosure", className)} style={style} {...scopeAttributes(attributes)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          openRef.current = !openRef.current;
          setLocalOpen({ value: openRef.current });
          onOpenChange?.(openRef.current);
        }}
      >
        {title}
      </button>
      {open ? <p>Details of {title}</p> : null}
    </div>
  );
}
