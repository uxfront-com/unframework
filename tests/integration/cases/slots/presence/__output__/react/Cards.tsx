import Card from "./Card";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface CardsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Cards({ className, style, ...attributes }: CardsAttributes) {
  return (
    <div className={cx("cards", className)} style={style} {...scopeAttributes(attributes)}>
      <Card label="Full" title={<h3>Weather</h3>}>
        <p>Sunny, 21°</p>
      </Card>
      <Card label="Bare" />
    </div>
  );
}
