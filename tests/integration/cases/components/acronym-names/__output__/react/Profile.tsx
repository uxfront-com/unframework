import Avatar from "./Avatar";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
