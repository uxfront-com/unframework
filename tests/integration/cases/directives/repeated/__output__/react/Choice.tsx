import { type ComponentPropsWithRef, type ReactNode, useRef, useState } from "react";

export interface ChoiceSlots {
  body?: ReactNode;
}

export type ChoiceAttributes = Omit<ComponentPropsWithRef<"div">, "body" | "children">;

export default function Choice({
  body,
  className,
  style,
  ...attributes
}: ChoiceSlots & ChoiceAttributes) {
  const [first, setFirst] = useState(true);
  const firstRef = useRef(first);

  return (
    <div className={cx("choice", className)} style={style} {...attributes}>
      {first ? <b>{body}</b> : <i>{body}</i>}
      <button
        type="button"
        onClick={() => {
          firstRef.current = !firstRef.current;
          setFirst(firstRef.current);
        }}
      >
        Switch
      </button>
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
