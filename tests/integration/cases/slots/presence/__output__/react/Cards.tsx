import Card from "./Card";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type CardsAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Cards({ className, style, ...attributes }: CardsAttributes) {
  return (
    <div className={cx("cards", className)} style={style} {...attributes}>
      <Card label="Full" title={<h3>Weather</h3>}>
        <p>Sunny, 21°</p>
      </Card>
      <Card label="Bare" />
    </div>
  );
}
