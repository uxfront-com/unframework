import "./Menu.css";
import { Transition, ref } from "@uxfront/unframework";

// A menu that closes and opens again 80 ms later, while its leave still runs.
export default function Menu() {
  const open = ref(true);

  function refresh() {
    open.value = false;
    setTimeout(() => {
      open.value = true;
    }, 80);
  }

  return (
    <nav class="menu" aria-label="Account">
      <button type="button" aria-expanded={open.value} onClick={refresh}>
        Refresh
      </button>
      <Transition name="fade">
        {open.value && (
          <ul class="items">
            <li>Profile</li>
          </ul>
        )}
      </Transition>
    </nav>
  );
}
