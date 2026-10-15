import type { CSSProperties } from "react";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Card({ className, style }: CardAttributes) {
  return (
    <p className={className} style={style}>
      Card
    </p>
  );
}
