import Amber from "./Amber";
import Blue from "./Blue";
import type { CSSProperties } from "react";

export interface ShelfAttributes {
  className?: string;
  style?: CSSProperties;
}

const items = [
  { label: "Warm", warm: true },
  { label: "Cool", warm: false },
];

export default function Shelf({ className, style, ...attributes }: ShelfAttributes) {
  return (
    <section className={className} style={style} {...scopeAttributes(attributes)}>
      <Blue>
        <p className="caption" data-uf-721c504a-s="">
          In blue
        </p>
      </Blue>
      <Amber>
        <p className="caption" data-uf-c97301b3-s="">
          In amber
        </p>
      </Amber>
      {items.map((item) => (
        <div key={item.label}>
          {(() => {
            const Tag = item.warm ? Amber : Blue;
            return (
              <Tag>
                <p className="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">
                  {item.label}
                </p>
              </Tag>
            );
          })()}
        </div>
      ))}
    </section>
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
