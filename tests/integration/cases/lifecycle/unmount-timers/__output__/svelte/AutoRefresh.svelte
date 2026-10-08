<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";

  export interface AutoRefreshProps {
    /** Milliseconds between two refreshes. */
    interval: number;
  }

  type Props = AutoRefreshProps & { onrefresh?: (count: number) => void };

  let { interval, onrefresh }: Props = $props();

  let enabled = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let refreshes = 0;

  function tick() {
    refreshes += 1;
    onrefresh?.(refreshes);
  }

  function toggle() {
    if (enabled) {
      clearInterval(timer);
      enabled = false;
    } else {
      timer = setInterval(tick, interval);
      enabled = true;
    }
  }

  onMount(() => () => {
    clearInterval(timer);
  });
</script>

<section class="auto-refresh" aria-label="Auto-refresh">
  <button type="button" aria-pressed={enabled} onclick={toggle}>Auto-refresh</button
  ><p role="status">{enabled ? "Refreshing" : "Paused"}</p>
</section>
