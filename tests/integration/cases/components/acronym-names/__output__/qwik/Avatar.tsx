import { type CSSProperties, type ClassList, type QRL, component$ } from "@qwik.dev/core";

export interface AvatarEvents {
  onPickedURL$?: QRL<(url: string) => void>;
}

export default component$<
  { imageURL: string; userID: number } & AvatarEvents & { class?: ClassList; style?: CSSProperties }
>(({ imageURL, userID, onPickedURL$, class: className, style }) => {
  return (
    <button
      type="button"
      data-user={userID}
      onClick$={() => onPickedURL$?.(imageURL)}
      class={className}
      style={style}
    >
      User {userID}: {imageURL}
    </button>
  );
});
