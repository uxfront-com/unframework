import Heading from "./Heading";
import type { CSSProperties } from "react";

export interface OutlineAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Outline({ className, style }: OutlineAttributes) {
  return (
    <main className={className} style={style}>
      <Heading tag="h1" text="Guide" />
      <Heading tag="h2" text="Setup" />
      <Heading tag="h3" text="Requirements" />
    </main>
  );
}
