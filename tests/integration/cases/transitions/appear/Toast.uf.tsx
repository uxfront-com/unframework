import "./Toast.css";
import { Transition } from "@uxfront/unframework";

// A toast that runs its enter as it first mounts, with `appear`.
export default function Toast() {
  return (
    <Transition name="pop" appear>
      <p class="toast" role="status">
        Saved
      </p>
    </Transition>
  );
}
