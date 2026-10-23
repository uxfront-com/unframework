import type { CSSProperties, ReactNode } from "react";

export interface NamesSlots {
  renderDefault?: (props: { item: string }) => ReactNode;
}

export interface NamesAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Names({
  names,
  renderDefault,
  className,
  style,
  ...attributes
}: { names: string[] } & NamesSlots & NamesAttributes) {
  return (
    <ul aria-label="Names" className={className} style={style} {...scopeAttributes(attributes)}>
      {names.map((item) => (
        <li key={item}>{renderDefault?.({ item })}</li>
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
