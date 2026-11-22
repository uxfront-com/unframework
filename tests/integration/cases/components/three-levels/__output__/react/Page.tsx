import Section from "./Section";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface PageAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Page({
  name,
  className,
  style,
  ...attributes
}: { name: string } & PageAttributes) {
  return (
    <article
      aria-label="Profile"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Section title={`About ${name}`} body="Three components deep." />
      <Section title="Contact" body={`Write to ${name}.`} />
    </article>
  );
}
