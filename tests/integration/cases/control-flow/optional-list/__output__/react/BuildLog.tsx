import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
}: BuildLogProps & BuildLogAttributes) {
  return (
    <section
      className={cx("build-log", className)}
      aria-label="Build log"
      style={style}
      {...scopeAttributes(attributes)}
    >
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
