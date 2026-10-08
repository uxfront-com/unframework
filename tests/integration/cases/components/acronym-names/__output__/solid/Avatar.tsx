export interface AvatarEvents {
  onPickedURL?: (url: string) => void;
}

export default function Avatar(props: { imageURL: string; userID: number } & AvatarEvents) {
  return (
    <button
      type="button"
      data-user={props.userID}
      onClick={() => props.onPickedURL?.(props.imageURL)}
    >
      User {props.userID}: {props.imageURL}
    </button>
  );
}
