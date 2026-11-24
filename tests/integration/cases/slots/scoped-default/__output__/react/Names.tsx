import type { ComponentPropsWithRef, ReactNode } from "react";

export interface NamesSlots {
  renderDefault?: (props: { item: string }) => ReactNode;
}

export type NamesAttributes = Omit<
  ComponentPropsWithRef<"ul">,
  "names" | "renderDefault" | "children"
>;

export default function Names({
  names,
  renderDefault,
  className,
  style,
  ...attributes
}: { names: string[] } & NamesSlots & NamesAttributes) {
  return (
    <ul aria-label="Names" className={className} style={style} {...attributes}>
      {names.map((item) => (
        <li key={item}>{renderDefault?.({ item })}</li>
      ))}
    </ul>
  );
}
