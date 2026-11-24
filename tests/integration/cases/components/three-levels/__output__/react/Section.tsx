import Heading from "./Heading";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type SectionAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "title" | "body" | "children"
>;

export default function Section({
  title,
  body,
  className,
  style,
  ...attributes
}: { title: string; body: string } & SectionAttributes) {
  return (
    <section className={cx("section", className)} style={style} {...attributes}>
      <Heading text={title} />
      <p>{body}</p>
    </section>
  );
}
