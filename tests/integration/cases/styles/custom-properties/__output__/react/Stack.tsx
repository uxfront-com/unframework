import type { CSSProperties } from "react";

export interface StackAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Stack({
  gap,
  accent,
  className,
  style,
}: { gap: string; accent: string } & StackAttributes) {
  return (
    <ul
      className={cx("stack", className)}
      style={{ "--gap": gap, "--accent": accent, ...style } as CSSProperties}
      data-uf-e3a22111=""
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
