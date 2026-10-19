import Frame from "./Frame";
import type { CSSProperties } from "react";

export interface GalleryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Gallery({ className, style }: GalleryAttributes) {
  return (
    <div className={className} style={style}>
      <Frame label="Card" wide={false} title="Sunset" />
      <Frame label="Panel" wide={true} title="Dawn" />
      <Frame label="Empty" wide={true} />
    </div>
  );
}
