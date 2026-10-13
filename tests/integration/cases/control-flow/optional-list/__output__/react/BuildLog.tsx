import type { CSSProperties } from "react";

interface LogLine {
  id: string;
  text: string;
}

export interface BuildLogProps {
  target: string;
  failed: boolean;
  lines?: LogLine[] | null;
  warnings?: string[];
}

export interface BuildLogAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function BuildLog({
  target,
  failed,
  lines,
  warnings,
  className,
  style,
}: BuildLogProps & BuildLogAttributes) {
  return (
    <section className={cx("build-log", className)} aria-label="Build log" style={style}>
      <pre>
        $ make {target}
        {failed ? <strong> (failed)</strong> : null}
        {"\n"}
        {(lines ?? []).map((line) => (
          <code key={line.id}>
            {line.text}
            {"\n"}
          </code>
        ))}
      </pre>
      <ul aria-label="Warnings">
        {(warnings ?? []).map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
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
