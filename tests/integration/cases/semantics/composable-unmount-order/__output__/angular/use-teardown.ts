import { isPlatformBrowser } from "@angular/common";
import { DestroyRef, PLATFORM_ID, computed, inject } from "@angular/core";

export function useTeardown(name: () => string, report: (entry: string) => void) {
  const browser = isPlatformBrowser(inject(PLATFORM_ID));

  const title = computed(() => `Panel ${name()}`);

  if (browser) {
    inject(DestroyRef).onDestroy(() => {
      report(`${name()} closed`);
    });
  }

  return { title };
}
