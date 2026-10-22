import type { CSSProperties, ReactNode } from "react";

export interface LayoutSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export interface LayoutAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Layout({
  title,
  children,
  className,
  style,
  ...attributes
}: LayoutSlots & LayoutAttributes) {
  return (
    <main className={className} style={style} {...scopeAttributes(attributes)}>
      <h1>{title}</h1>
      {children}
    </main>
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
