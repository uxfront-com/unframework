import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";

export interface DisclosureModels {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
}: { title: string } & DisclosureModels & DisclosureAttributes) {
  const [localOpen, setLocalOpen] = useState<boolean>(false);
  const open = openProp === undefined ? localOpen : openProp;
  const openRef = useRef(open);

  useLayoutEffect(() => {
    openRef.current = open;
  });

  return (
    <div className={cx("disclosure", className)} style={style}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          openRef.current = !openRef.current;
          setLocalOpen(openRef.current);
          onOpenChange?.(openRef.current);
        }}
      >
        {title}
      </button>
      {open ? <p>Details of {title}</p> : null}
    </div>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
