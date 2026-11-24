import Steps from "./Steps";
import type { ComponentPropsWithRef } from "react";

export type RecipeAttributes = Omit<ComponentPropsWithRef<"div">, "steps" | "children">;

export default function Recipe({
  steps,
  className,
  style,
  ...attributes
}: { steps: string[] } & RecipeAttributes) {
  return (
    <div className={className} style={style} {...attributes}>
      <Steps steps={steps} marker={<span aria-hidden="true">&gt; </span>} />
    </div>
  );
}
