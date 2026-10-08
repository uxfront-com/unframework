import { $, type QRL, component$, useConstant, useSignal, useVisibleTask$ } from "@qwik.dev/core";

export interface ProfileMenuEvents {
  onClosed$?: QRL<() => void>;
}

export default component$<ProfileMenuEvents>(({ onClosed$ }) => {
  const open = useSignal(false);
  const menu = useSignal<HTMLDivElement>();

  const onDocumentClick = useConstant(() =>
    $((event: MouseEvent) => {
      const element = menu.value ?? null;
      if (open.value && element && !element.contains(event.target as Node)) {
        open.value = false;
        onClosed$?.();
      }
    }),
  );

  useVisibleTask$(
    () => {
      document.addEventListener("click", onDocumentClick);
    },
    { strategy: "document-ready" },
  );

  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(() => {
        document.removeEventListener("click", onDocumentClick);
      });
    },
    { strategy: "document-ready" },
  );

  return (
    <section class="profile-menu" aria-label="Profile">
      <div class="menu" ref={menu}>
        <button
          type="button"
          aria-expanded={open.value}
          onClick$={() => (open.value = !open.value)}
        >
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
});
