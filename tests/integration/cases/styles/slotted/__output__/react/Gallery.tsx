import Frame from "./Frame";
import type { CSSProperties } from "react";

export interface GalleryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Gallery({ className, style, ...attributes }: GalleryAttributes) {
  return (
    <section className={className} style={style} {...scopeAttributes(attributes)}>
      <Frame>
        <p className="caption" data-uf-9dc516fd-s="">
          A quiet harbour
        </p>
      </Frame>
      <p className="caption">Outside the frame</p>
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
