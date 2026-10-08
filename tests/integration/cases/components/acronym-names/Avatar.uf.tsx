import { defineEmits } from "unframework";

export default function Avatar({ imageURL, userID }: { imageURL: string; userID: number }) {
  const emit = defineEmits<{ pickedURL: [url: string] }>();
  return (
    <button type="button" data-user={userID} onClick={() => emit("pickedURL", imageURL)}>
      User {userID}: {imageURL}
    </button>
  );
}
