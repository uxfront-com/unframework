export interface AvatarEvents {
  onPickedURL?: (url: string) => void;
}

export default function Avatar({
  imageURL,
  userID,
  onPickedURL,
}: { imageURL: string; userID: number } & AvatarEvents) {
  return (
    <button type="button" data-user={userID} onClick={() => onPickedURL?.(imageURL)}>
      User {userID}: {imageURL}
    </button>
  );
}
