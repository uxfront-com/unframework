import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface AvatarEvents {
  onPickedURL$?: QRL<(url: string) => void>;
}

export default component$<
  { imageURL: string; userID: number } & AvatarEvents &
    Omit<PropsOf<"button">, "imageURL" | "userID" | "onPickedURL$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ imageURL, userID, onPickedURL$, class: className, style, onClick$, ...attributes }) => {
  return (
    <button
      type="button"
      data-user={userID}
      onClick$={[$(() => onPickedURL$?.(imageURL)), onClick$]}
      class={className}
      style={style}
      {...attributes}
    >
      User {userID}: {imageURL}
    </button>
  );
});
