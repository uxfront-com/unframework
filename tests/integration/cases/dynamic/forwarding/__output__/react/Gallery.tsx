import Frame from "./Frame";
import type { ComponentPropsWithRef } from "react";

export type GalleryAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Gallery({ className, style, ...attributes }: GalleryAttributes) {
  return (
    <div className={className} style={style} {...attributes}>
      <Frame label="Card" wide={false} title="Sunset" />
      <Frame label="Panel" wide={true} title="Dawn" />
      <Frame label="Empty" wide={true} />
    </div>
  );
}
