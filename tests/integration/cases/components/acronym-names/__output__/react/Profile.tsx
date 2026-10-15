import Avatar from "./Avatar";
import { type CSSProperties, useRef, useState } from "react";

export interface ProfileAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Profile({ className, style }: ProfileAttributes) {
  const [picked, setPicked] = useState("none");
  const pickedRef = useRef(picked);

  return (
    <div className={className} style={style}>
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
