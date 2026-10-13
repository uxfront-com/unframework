import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface UsageMeterProps {
  label: string;
  percent: number;
  colour: string;
  thickness: number;
}

export default component$<UsageMeterProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, percent, colour, thickness, class: className, style }) => {
    return (
      <div class={["usage-meter", className]} style={style}>
        <p style={{ color: colour, fontWeight: 700, lineHeight: 1.5, marginBottom: "4px" }}>
          {label}: {percent}%
        </p>
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          style={{
            "--meter-colour": colour,
            "--meter-value": percent,
            width: "200px",
            height: "12px",
            borderStyle: "solid",
            borderWidth: `${thickness}px`,
            borderColor: colour,
          }}
        >
          <div
            style={{ width: `${percent}%`, height: "100%", backgroundColor: "var(--meter-colour)" }}
          />
        </div>
        <p
          class="usage-meter-caption"
          style={{ color: colour, fontFamily: '"UF Test Sans", sans-serif' }}
        >
          {percent} of 100 used
        </p>
      </div>
    );
  },
);
