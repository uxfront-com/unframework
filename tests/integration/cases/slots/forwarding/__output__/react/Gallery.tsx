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
      <Frame label="Filled" title="Sunset">
        <p>Taken at dusk.</p>
      </Frame>
      <Frame label="Empty" />
    </div>
  );
}
