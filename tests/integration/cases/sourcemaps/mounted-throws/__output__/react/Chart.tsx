import { type ComponentPropsWithRef, useEffect, useEffectEvent } from "react";

export type ChartAttributes = Omit<ComponentPropsWithRef<"p">, "children">;

export default function Chart({ className, style, ...attributes }: ChartAttributes) {
  const onMount = useEffectEvent(() => {
    throw new Error("The chart could not start");
  });
  useEffect(() => {
    onMount();
  }, []);

  return (
    <p className={className} style={style} {...attributes}>
      Chart
    </p>
  );
}
