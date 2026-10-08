<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";

  type Props = { onjoin?: (channel: string) => void; onleave?: (channel: string) => void };

  let { onjoin, onleave }: Props = $props();

  let channel = $state("general");

  const watchedName = $derived(channel.toLowerCase());
  let previousName = untrack(() => watchedName);
  let nameWatched = false;
  let cleanupName: (() => void) | undefined;
  $effect.pre(() => {
    const name = watchedName;
    if (nameWatched && Object.is(name, previousName)) return;
    nameWatched = true;
    previousName = name;
    untrack(() => {
      cleanupName?.();
      const cleanups: (() => void)[] = [];
      cleanupName = () => {
        for (const cleanup of cleanups) cleanup();
      };
      const onCleanup = (cleanup: () => void) => {
        cleanups.push(cleanup);
      };
      onjoin?.(name);
      onCleanup(() => {
        onleave?.(name);
      });
    });
  });
  onMount(() => () => cleanupName?.());
</script>

<section class="channel-picker" aria-label="Channels">
  <p role="status">Channel: #{channel}</p
  ><button type="button" onclick={() => (channel = "random")}>Join #random</button
  ><button type="button" onclick={() => (channel = "General")}>Join #General</button>
</section>
