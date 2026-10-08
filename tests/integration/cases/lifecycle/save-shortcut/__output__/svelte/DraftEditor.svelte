<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";

  type Props = { onsaved?: (count: number) => void };

  let { onsaved }: Props = $props();

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

<section class="draft-editor" aria-label="Draft">
  <label>Draft<textarea name="draft"></textarea></label
  ><p role="status">Saved: {saves}</p>
</section>
