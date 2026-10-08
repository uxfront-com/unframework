import { defineEmits, onMounted, onUnmounted, ref, useTemplateRef } from "unframework";

export default function ProfileMenu() {
  const emit = defineEmits<{ closed: [] }>();

  const open = ref(false);
  const menu = useTemplateRef<HTMLDivElement>();

  function onDocumentClick(event: MouseEvent) {
    const element = menu.value;
    if (open.value && element && !element.contains(event.target as Node)) {
      open.value = false;
      emit("closed");
    }
  }

  onMounted(() => {
    document.addEventListener("click", onDocumentClick);
  });

  onUnmounted(() => {
    document.removeEventListener("click", onDocumentClick);
  });

  return (
    <section class="profile-menu" aria-label="Profile">
      <div class="menu" ref={menu}>
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
