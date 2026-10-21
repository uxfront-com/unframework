import type { CSSProperties } from "react";

export interface UsageMeterProps {
  label: string;
  percent: number;
  colour: string;
  thickness: number;
}

export interface UsageMeterAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <div className={cx("usage-meter", className)} style={style} {...scopeAttributes(attributes)}>
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
