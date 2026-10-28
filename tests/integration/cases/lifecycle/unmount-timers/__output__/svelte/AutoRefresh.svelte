<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface AutoRefreshProps {
    /** Milliseconds between two refreshes. */
    interval: number;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = AutoRefreshProps & {
    onrefresh?: (count: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { interval, onrefresh, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["auto-refresh", className]}
  aria-label="Auto-refresh"
  {style}
  {...scopeAttributes(attributes)}
>
  <button type="button" aria-pressed={enabled} onclick={toggle}>Auto-refresh</button
  ><p role="status">{enabled ? "Refreshing" : "Paused"}</p>
</section>
