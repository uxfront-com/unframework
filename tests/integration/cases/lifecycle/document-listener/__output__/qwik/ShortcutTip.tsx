import { $, type QRL, component$, useConstant, useSignal, useVisibleTask$ } from "@qwik.dev/core";

export interface ShortcutTipEvents {
  onDismissed$?: QRL<() => void>;
  onShortcut$?: QRL<(key: string, count: number) => void>;
}

export default component$<ShortcutTipEvents>(({ onDismissed$, onShortcut$ }) => {
  const open = useSignal(true);
  const enabled = useSignal(false);
  const count = useSignal(0);

  const onEscape = useConstant(() =>
    $((event: KeyboardEvent) => {
      if (event.key === "Escape") {
        open.value = false;
        onDismissed$?.();
      }
    }),
  );

  const onShortcut = useConstant(() =>
    $((event: KeyboardEvent) => {
      if (event.key === "k") {
        count.value += 1;
        onShortcut$?.(event.key, count.value);
      }
    }),
  );

  const toggle = $(() => {
    enabled.value = !enabled.value;
  });

  const previousEnabled = useSignal(() => enabled.value);
  useVisibleTask$(
    ({ track }) => {
      const on = track(enabled);
      if (Object.is(on, previousEnabled.value)) return;
      previousEnabled.value = on;
      if (on) {
        document.addEventListener("keydown", onShortcut);
      } else {
        document.removeEventListener("keydown", onShortcut);
      }
    },
    { strategy: "document-ready" },
  );

  useVisibleTask$(
    () => {
      document.addEventListener("keydown", onEscape);
    },
    { strategy: "document-ready" },
  );

  useVisibleTask$(
    ({ cleanup }) => {
      cleanup(() => {
        document.removeEventListener("keydown", onEscape);
        document.removeEventListener("keydown", onShortcut);
      });
    },
    { strategy: "document-ready" },
  );

  return (
    <section class="shortcut-tip" aria-label="Shortcuts">
      <p>{open.value ? "Press Escape to hide this tip." : "Tip hidden."}</p>
      <button type="button" aria-pressed={enabled.value} onClick$={toggle}>
        Shortcut K
      </button>
      <p role="status">Used: {count.value}</p>
    </section>
  );
});
