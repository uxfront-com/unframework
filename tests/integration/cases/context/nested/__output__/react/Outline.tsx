import Level from "./Level";
import type { CSSProperties } from "react";

export interface OutlineAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Outline({ className, style }: OutlineAttributes) {
  return (
    <Level title="Book" className={className} style={style}>
      <Level title="Part">
        <Level title="Chapter" />
      </Level>
      <Level title="Appendix" />
    </Level>
  );
}
