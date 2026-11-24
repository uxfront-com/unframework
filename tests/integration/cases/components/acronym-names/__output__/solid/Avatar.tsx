import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface AvatarEvents {
  onPickedURL?: (url: string) => void;
}

export default function Avatar(
  props: { imageURL: string; userID: number } & AvatarEvents &
    Omit<ComponentProps<"button">, "imageURL" | "userID" | "style" | "onClick"> & {
      style?: JSX.CSSProperties;
      onClick?: Extract<ComponentProps<"button">["onClick"], (event: never) => void>;
    },
) {
  const [, others] = splitProps(props, ["imageURL", "userID", "onPickedURL", "onClick"]);

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
