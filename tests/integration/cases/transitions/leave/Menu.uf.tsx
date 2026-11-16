import "./Menu.css";
import { Transition, ref } from "@uxfront/unframework";

// A menu, open at first, that leaves with the `fade` transition.
export default function Menu() {
  const open = ref(true);

  return (
    <nav class="menu" aria-label="Account">
      <button type="button" aria-expanded={open.value} onClick={() => (open.value = !open.value)}>
        Account
      </button>
      <Transition name="fade">
        {open.value && (
          <ul class="items">
            <li>Profile</li>
            <li>Sign out</li>
          </ul>
        )}
      </Transition>
    </nav>
  );
}
