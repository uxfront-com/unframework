import { ref } from "unframework";

import Avatar from "./Avatar.uf.tsx";

export default function Profile() {
  const picked = ref("none");
  return (
    <div>
      <Avatar imageURL="/a.png" userID={7} onPickedURL={(url) => (picked.value = url)} />
      <output>Picked: {picked.value}</output>
    </div>
  );
}
