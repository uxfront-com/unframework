import type { CSSProperties } from "react";

export interface CountdownAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Countdown({
  from,
  className,
  style,
}: { from: number } & CountdownAttributes) {
  return (
    <div className={cx("level", className)} style={style}>
      <span>{from}</span>
      {from > 0 ? <Countdown from={from - 1} /> : <strong>Liftoff</strong>}
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
