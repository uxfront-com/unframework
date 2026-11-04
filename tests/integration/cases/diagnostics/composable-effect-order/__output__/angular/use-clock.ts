import { afterNextRender, signal } from "@angular/core";

export function useClock() {
  const started = signal(false);

  afterNextRender(() => {
    started.set(true);
  });

  return { started: started.asReadonly() };
}
