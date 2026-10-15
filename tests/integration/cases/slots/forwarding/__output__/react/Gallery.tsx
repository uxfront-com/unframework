import Frame from "./Frame";
import type { CSSProperties } from "react";

export interface GalleryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Gallery({ className, style }: GalleryAttributes) {
  return (
    <div className={className} style={style}>
      <Frame label="Filled" title="Sunset">
        <p>Taken at dusk.</p>
      </Frame>
      <Frame label="Empty" />
    </div>
  );
}
