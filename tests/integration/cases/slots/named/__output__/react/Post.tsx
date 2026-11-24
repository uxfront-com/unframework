import Card from "./Card";
import type { ComponentPropsWithRef } from "react";

export type PostAttributes = Omit<
  ComponentPropsWithRef<typeof Card>,
  "author" | "children" | "header" | "footer"
>;

export default function Post({
  author,
  className,
  style,
  ...attributes
}: { author: string } & PostAttributes) {
  return (
    <Card
      className={className}
      style={style}
      {...attributes}
      header={<h2>Release notes</h2>}
      footer={<small>By {author}</small>}
    >
      <p>Slots arrive in M3.</p>
    </Card>
  );
}
