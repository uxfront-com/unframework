import { type ComponentPropsWithRef, type ReactNode, useRef, useState } from "react";

export interface DisclosureSlots {
  children?: ReactNode;
}

export type DisclosureAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Disclosure({
  children,
  className,
  style,
  ...attributes
}: DisclosureSlots & DisclosureAttributes) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);

  return (
    <div className={cx("disclosure", className)} style={style} {...attributes}>
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
