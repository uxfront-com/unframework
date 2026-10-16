<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { onsaved?: (count: number) => void; class?: ClassValue; style?: string };

  let { onsaved, class: className, style }: Props = $props();

  let saves = $state(0);

  function onShortcut(event: KeyboardEvent) {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    saves += 1;
    onsaved?.(saves);
  }

  onMount(() => {
    document.addEventListener("keydown", onShortcut);
  });

  onMount(() => () => {
    document.removeEventListener("keydown", onShortcut);
  });
</script>

<section class={["draft-editor", className]} aria-label="Draft" {style}>
  <label>Draft<textarea name="draft"></textarea></label
  ><p role="status">Saved: {saves}</p>
</section>
