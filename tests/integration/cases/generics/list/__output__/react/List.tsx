import type { CSSProperties } from "react";

export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

export interface ListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function List<T>({
  label,
  items,
  selected,
  className,
  style,
  ...attributes
}: ListProps<T> & ListAttributes) {
  return (
    <ul aria-label={label} className={className} style={style} {...scopeAttributes(attributes)}>
      {items.map((item, index) => (
        <li key={index} aria-current={item === selected ? "true" : undefined}>
          {String(item)}
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
