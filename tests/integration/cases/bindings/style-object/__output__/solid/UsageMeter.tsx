export interface UsageMeterProps {
  label: string;
  percent: number;
  colour: string;
  thickness: number;
}

export default function UsageMeter(props: UsageMeterProps) {
  return (
    <div class="usage-meter">
      <p
        style={{
          color: props.colour,
          "font-weight": "700",
          "line-height": "1.5",
          "margin-bottom": "4px",
        }}
      >
        {props.label}: {props.percent}%
      </p>
      <div
        role="progressbar"
        aria-label={props.label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={props.percent}
        style={{
          "--meter-colour": props.colour,
          "--meter-value": props.percent,
          width: "200px",
          height: "12px",
          "border-style": "solid",
          "border-width": `${props.thickness}px`,
          "border-color": props.colour,
        }}
      >
        <div
          style={{
            width: `${props.percent}%`,
            height: "100%",
            "background-color": "var(--meter-colour)",
          }}
        />
      </div>
      <p
        class="usage-meter-caption"
        style={{ color: props.colour, "font-family": '"UF Test Sans", sans-serif' }}
      >
        {props.percent} of 100 used
      </p>
    </div>
  );
}
