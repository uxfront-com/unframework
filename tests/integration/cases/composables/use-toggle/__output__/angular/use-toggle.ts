import { signal } from "@angular/core";

export function useToggle(initial: boolean) {
  const on = signal(initial);

  function toggle() {
    on.set(!on());
  }

  function close() {
    on.set(false);
  }

  return { on: on.asReadonly(), toggle, close };
}
