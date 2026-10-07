// UF2011 invalid-write: a setup arrow function whose expression body writes state returns the
// written value, which the targets that rewrite writes into setter calls cannot keep; the safe
// fix gives it a block body.
import { ref } from "unframework";

export default function NotificationToggle() {
  const on = ref(false);
  const flip = () => (on.value = !on.value);

  return (
    <button type="button" aria-pressed={on.value} onClick={flip}>
      Notifications
    </button>
  );
}
