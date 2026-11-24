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
