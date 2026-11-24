import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useTeardown } from "./useTeardown";
import type { CSSProperties } from "react";

export interface PanelEvents {
  onClosed?: (entry: string) => void;
}

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({
  name,
  onClosed,
  className,
  style,
  ...attributes
}: { name: string } & PanelEvents & PanelAttributes) {
  const { title } = useTeardown(
    () => name,
    (entry) => onClosed?.(entry),
  );

  return (
    <section
      className={cx("panel", className)}
      aria-label={title}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <h2>{title}</h2>
    </section>
  );
}
