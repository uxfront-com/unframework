import type { JSX } from "solid-js";

export interface UsageMeterProps {
  label: string;
  percent: number;
  colour: string;
  thickness: number;
}

export default function UsageMeter(
  props: UsageMeterProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `usage-meter ${props.class}` : "usage-meter"}
      style={props.style}
      {...scopeAttributes(props)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
