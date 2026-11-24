import Frame from "./Frame";
import type { ComponentPropsWithRef } from "react";

export type GalleryAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Gallery({ className, style, ...attributes }: GalleryAttributes) {
  return (
    <div className={className} style={style} {...attributes}>
      <Frame label="Filled" title="Sunset">
        <p>Taken at dusk.</p>
      </Frame>
      <Frame label="Empty" />
    </div>
  );
}
