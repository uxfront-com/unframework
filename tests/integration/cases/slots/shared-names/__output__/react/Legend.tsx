import type { CSSProperties, ReactNode } from "react";

export interface LegendSlots {
  renderSwatch?: (props: { item: string }) => ReactNode;
  renderCaption?: (props: { item: string }) => ReactNode;
}

export interface LegendAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Legend({
  items,
  label,
  renderSwatch,
  renderCaption,
  className,
  style,
  ...attributes
}: { items: string[]; label: string } & LegendSlots & LegendAttributes) {
  return (
    <ul aria-label={label} className={className} style={style} {...scopeAttributes(attributes)}>
      {items.map((item) => (
        <li key={item}>
          <span>{renderSwatch?.({ item })}</span> <span>{renderCaption?.({ item })}</span>
        </li>
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
