import type { ComponentPropsWithRef } from "react";

export interface AvatarEvents {
  onPickedURL?: (url: string) => void;
}

export type AvatarAttributes = Omit<
  ComponentPropsWithRef<"button">,
  "imageURL" | "userID" | "onPickedURL" | "children"
>;

export default function Avatar({
  imageURL,
  userID,
  onPickedURL,
  className,
  style,
  onClick,
  ...attributes
}: { imageURL: string; userID: number } & AvatarEvents & AvatarAttributes) {
  return (
    <button
      type="button"
      data-user={userID}
      onClick={(event) => {
        onPickedURL?.(imageURL);
        onClick?.(event);
      }}
      className={className}
      style={style}
      {...attributes}
    >
      User {userID}: {imageURL}
    </button>
  );
}
