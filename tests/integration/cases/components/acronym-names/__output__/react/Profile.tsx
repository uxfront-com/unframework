import Avatar from "./Avatar";
import { type CSSProperties, useRef, useState } from "react";

export interface ProfileAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Profile({ className, style, ...attributes }: ProfileAttributes) {
  const [picked, setPicked] = useState("none");
  const pickedRef = useRef(picked);

  return (
    <div className={className} style={style} {...scopeAttributes(attributes)}>
      <Avatar
        imageURL="/a.png"
        userID={7}
        onPickedURL={(url) => {
          pickedRef.current = url;
          setPicked(pickedRef.current);
        }}
      />
      <output>Picked: {picked}</output>
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
