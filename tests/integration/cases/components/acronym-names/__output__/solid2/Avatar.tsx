import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface AvatarEvents {
  onPickedURL?: (url: string) => void;
}

export default function Avatar(
  props: { imageURL: string; userID: number } & AvatarEvents &
    Omit<ComponentProps<"button">, "imageURL" | "userID" | "class" | "style" | "onClick"> & {
      class?: string;
      style?: JSX.CSSProperties;
      onClick?: Extract<ComponentProps<"button">["onClick"], (event: never) => void>;
    },
) {
  const others = omit(props, "imageURL", "userID", "onPickedURL", "onClick");

  return (
    <button
      type="button"
      data-user={props.userID}
      onClick={(event) => {
        props.onPickedURL?.(props.imageURL);
        props.onClick?.(event);
      }}
      {...others}
    >
      User {props.userID}: {props.imageURL}
    </button>
  );
}
