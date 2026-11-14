<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ToastProps {
    message: string;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import "./Toast.uf.tsx.css";

  let { message }: ToastProps = $props();

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
  <div
    {@attach teleport("body")}
    data-teleported="true"
    class="toast"
    role="alert"
    data-uf-416dbabb=""
  >
    <p data-uf-416dbabb="">{message}</p>
  </div>
{/if}
