import { signal } from "@angular/core";

export function useToggle(initial: boolean) {
  const on = signal(initial);

  function toggle() {
    on.set(!on());
  }

  return { on: on.asReadonly(), toggle };
}
