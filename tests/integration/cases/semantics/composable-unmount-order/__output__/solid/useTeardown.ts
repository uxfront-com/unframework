import { createMemo, onCleanup, onMount } from "solid-js";

export function useTeardown(name: () => string, report: (entry: string) => void) {
  const title = createMemo(() => `Panel ${name()}`);

  onMount(() => onCleanup(() => report(`${name()} closed`)));

  return { title };
}
