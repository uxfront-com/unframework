<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TipProps {
    label: string;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";

  let { label }: TipProps = $props();

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });

  /** Moves the element into the element `to` selects, and removes it on teardown. */
  function teleport(to: string): (element: HTMLElement) => () => void {
    return (element) => {
      const target = document.querySelector(to);
      if (!target) element.remove();
      else {
        const active = document.activeElement;
        target.append(element);
        // Moving a node blurs what it holds, which a component inside it may have focused.
        if (active instanceof HTMLElement && element.contains(active)) active.focus();
      }
      return () => element.remove();
    };
  }
</script>

{#if mounted}
  <p {@attach teleport("body")} data-teleported="true" class="tip" role="note">{label} tip</p>
{/if}
