import { Show, createSignal, onCleanup, onMount } from "solid-js";

export interface ProfileMenuEvents {
  onClosed?: () => void;
}

export default function ProfileMenu(props: ProfileMenuEvents) {
  const [open, setOpen] = createSignal(false);
  let menu: HTMLDivElement | null = null;

  function onDocumentClick(event: MouseEvent) {
    const element = menu;
    if (open() && element && !element.contains(event.target as Node)) {
      setOpen(false);
      props.onClosed?.();
    }
  }

  onMount(() => {
    document.addEventListener("click", onDocumentClick);
  });

  onMount(() =>
    onCleanup(() => {
      document.removeEventListener("click", onDocumentClick);
    }),
  );

  return (
    <section class="profile-menu" aria-label="Profile">
      <div
        class="menu"
        ref={(element_1) => {
          menu = element_1;
          onCleanup(() => {
            menu = null;
          });
        }}
      >
        <button type="button" aria-expanded={open()} onClick={() => setOpen(!open())}>
          Account
        </button>
        <Show when={open()}>
          <ul aria-label="Account actions">
            <li>
              <button type="button">Settings</button>
            </li>
            <li>
              <button type="button">Sign out</button>
            </li>
          </ul>
        </Show>
      </div>
      <p>Outside the menu</p>
    </section>
  );
}
