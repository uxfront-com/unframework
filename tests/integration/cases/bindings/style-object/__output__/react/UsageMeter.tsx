import { cx } from "./_unframework/cx";
import type { CSSProperties, ComponentPropsWithRef } from "react";

export interface UsageMeterProps {
  label: string;
  percent: number;
  colour: string;
  thickness: number;
}

export type UsageMeterAttributes = Omit<
  ComponentPropsWithRef<"div">,
  "label" | "percent" | "colour" | "thickness" | "children"
>;

export default function UsageMeter({
  label,
  percent,
  colour,
  thickness,
  className,
  style,
  ...attributes
}: UsageMeterProps & UsageMeterAttributes) {
  return (
    <div className={cx("usage-meter", className)} style={style} {...attributes}>
      <p style={{ color: colour, fontWeight: 700, lineHeight: 1.5, marginBottom: "4px" }}>
        {label}: {percent}%
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        style={
          {
            "--meter-colour": colour,
            "--meter-value": percent,
            width: "200px",
            height: "12px",
            borderStyle: "solid",
            borderWidth: `${thickness}px`,
            borderColor: colour,
          } as CSSProperties
        }
      >
        <div
          style={{ width: `${percent}%`, height: "100%", backgroundColor: "var(--meter-colour)" }}
        />
      </div>
      <p
        className="usage-meter-caption"
        style={{ color: colour, fontFamily: '"UF Test Sans", sans-serif' }}
      >
        {percent} of 100 used
      </p>
    </div>
  );
}
