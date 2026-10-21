import type { CSSProperties, ReactNode } from "react";

export interface ListSlots {
  renderItem?: (props: { item: string; index: number }) => ReactNode;
}

export interface ListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function List({
  items,
  label,
  renderItem,
  className,
  style,
  ...attributes
}: { items: string[]; label: string } & ListSlots & ListAttributes) {
  return (
    <ul aria-label={label} className={className} style={style} {...scopeAttributes(attributes)}>
      {items.map((item, index) => (
        <li key={item}>{renderItem?.({ item, index })}</li>
      ))}
    </ul>
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
