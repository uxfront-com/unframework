import { type QRL, component$ } from "@qwik.dev/core";

export interface AvatarEvents {
  onPickedURL$?: QRL<(url: string) => void>;
}

export default component$<{ imageURL: string; userID: number } & AvatarEvents>(
  ({ imageURL, userID, onPickedURL$ }) => {
    return (
      <button type="button" data-user={userID} onClick$={() => onPickedURL$?.(imageURL)}>
        User {userID}: {imageURL}
      </button>
    );
  },
);
