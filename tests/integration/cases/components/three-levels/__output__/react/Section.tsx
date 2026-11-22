import Heading from "./Heading";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface SectionAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Section({
  title,
  body,
  className,
  style,
  ...attributes
}: { title: string; body: string } & SectionAttributes) {
  return (
    <section className={cx("section", className)} style={style} {...scopeAttributes(attributes)}>
      <Heading text={title} />
      <p>{body}</p>
    </section>
  );
}
