import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface AvatarEvents {
  onPickedURL?: (url: string) => void;
}

export interface AvatarAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Avatar({
  imageURL,
  userID,
  onPickedURL,
  className,
  style,
  ...attributes
}: { imageURL: string; userID: number } & AvatarEvents & AvatarAttributes) {
  return (
    <button
      type="button"
      data-user={userID}
      onClick={() => onPickedURL?.(imageURL)}
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      User {userID}: {imageURL}
    </button>
  );
}
