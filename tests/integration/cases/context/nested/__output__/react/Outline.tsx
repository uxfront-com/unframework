import Level from "./Level";
import type { ComponentPropsWithRef } from "react";

export type OutlineAttributes = Omit<ComponentPropsWithRef<typeof Level>, "children" | "title">;

export default function Outline({ className, style, ...attributes }: OutlineAttributes) {
  return (
    <Level title="Book" className={className} style={style} {...attributes}>
      <Level title="Part">
        <Level title="Chapter" />
      </Level>
      <Level title="Appendix" />
    </Level>
  );
}
