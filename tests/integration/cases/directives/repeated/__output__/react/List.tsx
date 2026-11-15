import type { CSSProperties, ReactNode } from "react";

export interface ListSlots {
  renderItem?: (props: { item: string }) => ReactNode;
}

export interface ListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function List({
  items,
  renderItem,
  className,
  style,
  ...attributes
}: { items: string[] } & ListSlots & ListAttributes) {
  return (
    <ol className={className} style={style} {...scopeAttributes(attributes)}>
      {items.map((item) => (
        <li key={item}>{renderItem?.({ item })}</li>
      ))}
    </ol>
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
