import { defineEmits, ref } from "@uxfront/unframework";

import { vClickOutside } from "./clickOutside.uf.ts";

export default function ProfileMenu() {
  const emit = defineEmits<{ closed: [] }>();

  const open = ref(false);

  function close() {
    if (!open.value) return;
    open.value = false;
    emit("closed");
  }

  return (
    <section class="profile-menu" aria-label="Profile">
      <div class="menu" v-click-outside={close}>
        <button type="button" aria-expanded={open.value} onClick={() => (open.value = !open.value)}>
          Account
        </button>
        {open.value ? (
          <ul aria-label="Account actions">
            <li>
              <button type="button">Settings</button>
            </li>
            <li>
              <button type="button">Sign out</button>
            </li>
          </ul>
        ) : null}
      </div>
      <p>Outside the menu</p>
    </section>
  );
}
