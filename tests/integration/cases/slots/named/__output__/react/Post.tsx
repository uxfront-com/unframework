import Card from "./Card";
import type { CSSProperties } from "react";

export interface PostAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Post({ author, className, style }: { author: string } & PostAttributes) {
  return (
    <Card
      className={className}
      style={style}
      header={<h2>Release notes</h2>}
      footer={<small>By {author}</small>}
    >
      <p>Slots arrive in M3.</p>
    </Card>
  );
}
