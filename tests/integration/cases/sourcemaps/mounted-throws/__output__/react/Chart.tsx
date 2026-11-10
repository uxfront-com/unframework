import { type CSSProperties, useEffect, useEffectEvent } from "react";

export interface ChartAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Chart({ className, style, ...attributes }: ChartAttributes) {
  const onMount = useEffectEvent(() => {
    throw new Error("The chart could not start");
  });
  useEffect(() => {
    onMount();
  }, []);

  return (
    <p className={className} style={style} {...scopeAttributes(attributes)}>
      Chart
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
