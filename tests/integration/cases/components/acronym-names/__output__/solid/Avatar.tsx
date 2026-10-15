import type { JSX } from "solid-js";

export interface AvatarEvents {
  onPickedURL?: (url: string) => void;
}

export default function Avatar(
  props: { imageURL: string; userID: number } & AvatarEvents & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  return (
    <button
      type="button"
      data-user={props.userID}
      onClick={() => props.onPickedURL?.(props.imageURL)}
      class={props.class}
      style={props.style}
    >
      User {props.userID}: {props.imageURL}
    </button>
  );
}
