import { onMount } from "svelte";

export function useTeardown(name: () => string, report: (entry: string) => void) {
  const title = $derived(`Panel ${name()}`);

  onMount(() => () => {
    report(`${name()} closed`);
  });

  return {
    get title() {
      return title;
    },
  };
}
