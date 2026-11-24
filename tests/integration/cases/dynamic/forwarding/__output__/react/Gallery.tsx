import Frame from "./Frame";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
