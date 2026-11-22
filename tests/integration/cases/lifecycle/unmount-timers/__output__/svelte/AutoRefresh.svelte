<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface AutoRefreshProps {
    /** Milliseconds between two refreshes. */
    interval: number;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "interval" | "onrefresh" | "children" | "class" | "style" | "ref"
  > &
    AutoRefreshProps & {
      onrefresh?: (count: number) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    interval,
    onrefresh,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

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

<section
  class={["auto-refresh", className]}
  aria-label="Auto-refresh"
  {style}
  bind:this={ref}
  {...attributes}
>
  <button type="button" aria-pressed={enabled} onclick={toggle}>Auto-refresh</button
  ><p role="status">{enabled ? "Refreshing" : "Paused"}</p>
</section>
