import { isPlatformBrowser } from "@angular/common";
import { DestroyRef, PLATFORM_ID, afterNextRender, inject, signal } from "@angular/core";

export function useMediaQuery(query: string) {
  const browser = isPlatformBrowser(inject(PLATFORM_ID));

  const matches = signal(false);

  let list: MediaQueryList | undefined;

  function update() {
    matches.set(list?.matches ?? false);
  }

  afterNextRender(() => {
    list = window.matchMedia(query);
    update();
    list.addEventListener("change", update);
  });

  if (browser) {
    inject(DestroyRef).onDestroy(() => {
      list?.removeEventListener("change", update);
    });
  }

  return { matches: matches.asReadonly() };
}
