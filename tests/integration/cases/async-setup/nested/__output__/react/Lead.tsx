import Member from "./Member";
import type { ComponentPropsWithoutRef } from "react";

export type LeadAttributes = Omit<ComponentPropsWithoutRef<typeof Member>, "id" | "children">;

export default function Lead({
  id,
  className,
  style,
  ...attributes
}: { id: string } & LeadAttributes) {
  return <Member id={id} className={className} style={style} {...attributes} />;
}
