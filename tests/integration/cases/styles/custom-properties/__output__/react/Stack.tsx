import { cx } from "./_unframework/cx";
import type { CSSProperties, ComponentPropsWithRef } from "react";
import "./Stack.uf.tsx.css";

export type StackAttributes = Omit<ComponentPropsWithRef<"ul">, "gap" | "accent" | "children">;

export default function Stack({
  gap,
  accent,
  className,
  style,
  ...attributes
}: { gap: string; accent: string } & StackAttributes) {
  return (
    <ul
      className={cx("stack", className)}
      style={{ "--gap": gap, "--accent": accent, ...style } as CSSProperties}
      data-uf-e3a22111=""
      {...attributes}
    >
      <li className="item" data-uf-e3a22111="">
        One
      </li>
      <li className="item" data-uf-e3a22111="">
        Two
      </li>
      <li className="item" data-uf-e3a22111="">
        Three
      </li>
    </ul>
  );
}
