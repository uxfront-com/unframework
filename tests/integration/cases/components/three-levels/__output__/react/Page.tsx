import Section from "./Section";
import type { ComponentPropsWithRef } from "react";

export type PageAttributes = Omit<ComponentPropsWithRef<"article">, "name" | "children">;

export default function Page({
  name,
  className,
  style,
  ...attributes
}: { name: string } & PageAttributes) {
  return (
    <article aria-label="Profile" className={className} style={style} {...attributes}>
      <Section title={`About ${name}`} body="Three components deep." />
      <Section title="Contact" body={`Write to ${name}.`} />
    </article>
  );
}
