import Frame from "./Frame";
import Mat from "./Mat";
import type { CSSProperties } from "react";

export interface GalleryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Gallery({
  matted = true,
  className,
  style,
  ...attributes
}: { matted?: boolean } & GalleryAttributes) {
  const Tag = matted ? Mat : Frame;

  return (
    <section className={className} style={style} {...scopeAttributes(attributes)}>
      <Frame>
        <p className="caption" data-uf-9dc516fd-s="">
          A quiet harbour
        </p>
      </Frame>
      <Frame
        renderLabel={({ text }) => (
          <p className="caption" data-uf-9dc516fd-s="">
            {text}
          </p>
        )}
      />
      <Tag>
        <p className="caption" data-uf-09929c4a-s="" data-uf-9dc516fd-s="">
          A matted print
        </p>
      </Tag>
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
