import { scopeAttributes } from "./_unframework/scopeAttributes";
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
