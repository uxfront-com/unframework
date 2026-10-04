import type { CSSProperties } from "react";

export interface UsageMeterProps {
  label: string;
  percent: number;
  colour: string;
  thickness: number;
}

export default function UsageMeter({ label, percent, colour, thickness }: UsageMeterProps) {
  return (
    <div className="usage-meter">
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
    </div>
  );
}
