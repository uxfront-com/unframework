import { type CSSProperties, type ReactNode, createContext, use, useState } from "react";

export interface LevelSlots {
  children?: ReactNode;
}

export interface LevelAttributes {
  className?: string;
  style?: CSSProperties;
}

export const DepthKey = createContext<number | undefined>(undefined);

export default function Level({
  title,
  children,
  className,
  style,
  ...attributes
}: { title: string } & LevelSlots & LevelAttributes) {
  const depth = use(DepthKey) ?? 0;
  const [depthValue] = useState(depth + 1);

  return (
    <DepthKey value={depthValue}>
      <section
        aria-label={title}
        className={className}
        style={style}
        {...scopeAttributes(attributes)}
      >
        <h2>
          {title} at depth {depth}
        </h2>
        {children}
      </section>
    </DepthKey>
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
