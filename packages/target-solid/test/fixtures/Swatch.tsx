import type { JSX } from "solid-js";

interface Paint {
  fill?: string;
  id?: string;
}

export interface SwatchProps {
  colour: string;
  turn: string;
  paint: Paint;
  order: number;
}

export default function Swatch(props: SwatchProps & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
      <svg viewBox="0 0 8 8" role="img">
        <title>Swatch</title>
        <defs>
          <linearGradient id="swatch-fill" {...{ opacity: "0.5" }} {...{ transform: props.turn }}>
            <stop offset="0" {...{ fill: props.colour }} />
            <stop {...{ fill: props.paint.fill }} id={props.paint.id} />
          </linearGradient>
        </defs>
        <path id="swatch-path" d="M0 0h8" />
        <mpath {...({ href: "#swatch-path" } as Record<string, unknown>)} />
      </svg>
      <dialog open {...({ tabindex: props.order } as Record<string, unknown>)}>
        Picked
      </dialog>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
