import Frame from "./Frame";
import type { CSSProperties } from "react";

export interface GalleryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Gallery({ className, style }: GalleryAttributes) {
  return (
    <section className={className} style={style}>
      <Frame>
        <p className="caption" data-uf-9dc516fd-s="">
          A quiet harbour
        </p>
      </Frame>
      <p className="caption">Outside the frame</p>
    </section>
  );
}
