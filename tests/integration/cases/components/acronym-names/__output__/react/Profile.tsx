import Avatar from "./Avatar";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type ProfileAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

export default function Profile({ className, style, ...attributes }: ProfileAttributes) {
  const [picked, setPicked] = useState("none");
  const pickedRef = useRef(picked);

  return (
    <div className={className} style={style} {...attributes}>
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
