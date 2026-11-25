import { ref } from "@uxfront/unframework";

import { vFocusTrap } from "./focusTrap.uf.ts";

export default function Settings() {
  const open = ref(false);

  function close() {
    open.value = false;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }

  return (
    <section class="settings" aria-label="Settings">
      <button type="button" onClick={() => (open.value = true)}>
        Open
      </button>
      {open.value ? (
        <div
          role="dialog"
          aria-label="Preferences"
          tabindex="-1"
          class="dialog"
          v-focus-trap={open.value}
          onKeydown={onKeydown}
        >
          <button type="button">Theme</button>
          <button type="button">Language</button>
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
      ) : null}
    </section>
  );
}
