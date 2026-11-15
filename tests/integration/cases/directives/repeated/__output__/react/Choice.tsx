import { type CSSProperties, type ReactNode, useRef, useState } from "react";

export interface ChoiceSlots {
  body?: ReactNode;
}

export interface ChoiceAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Choice({
  body,
  className,
  style,
  ...attributes
}: ChoiceSlots & ChoiceAttributes) {
  const [first, setFirst] = useState(true);
  const firstRef = useRef(first);

  return (
    <div className={cx("choice", className)} style={style} {...scopeAttributes(attributes)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
