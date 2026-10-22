import Frame from "./Frame";
import type { CSSProperties } from "react";

export interface GalleryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Gallery({ className, style, ...attributes }: GalleryAttributes) {
  return (
    <div className={className} style={style} {...scopeAttributes(attributes)}>
      <Frame label="Card" wide={false} title="Sunset" />
      <Frame label="Panel" wide={true} title="Dawn" />
      <Frame label="Empty" wide={true} />
    </div>
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
