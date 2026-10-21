import type { CSSProperties } from "react";
import "./Stack.uf.tsx.css";

export interface StackAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Stack({
  gap,
  accent,
  className,
  style,
  ...attributes
}: { gap: string; accent: string } & StackAttributes) {
  return (
    <ul
      className={cx("stack", className)}
      style={{ "--gap": gap, "--accent": accent, ...style } as CSSProperties}
      data-uf-e3a22111=""
      {...scopeAttributes(attributes)}
    >
      <li className="item" data-uf-e3a22111="">
        One
      </li>
      <li className="item" data-uf-e3a22111="">
        Two
      </li>
      <li className="item" data-uf-e3a22111="">
        Three
      </li>
    </ul>
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
